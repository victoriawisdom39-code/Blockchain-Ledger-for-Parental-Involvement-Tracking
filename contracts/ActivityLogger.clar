;; ActivityLogger Smart Contract
;; This contract serves as the core for logging parental involvement activities in family support programs.
;; It provides immutable, timestamped records with evidence hashes, verification, and dispute mechanisms.
;; Integrates conceptually with UserRegistry for roles, but assumes caller permissions here for simplicity.

;; Constants for error codes
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-INVALID-PARAM u101)
(define-constant ERR-ACTIVITY-NOT-FOUND u102)
(define-constant ERR-ALREADY-VERIFIED u103)
(define-constant ERR-ALREADY-DISPUTED u104)
(define-constant ERR-PAUSED u105)
(define-constant ERR-INVALID-EVIDENCE u106)
(define-constant ERR-MAX-LOGS_REACHED u107)
(define-constant ERR-INVALID_CHILD_ID u108)
(define-constant ERR-INVALID_ACTIVITY_TYPE u109)
(define-constant ERR-METADATA_TOO_LONG u110)

;; Data variables
(define-data-var contract-owner principal tx-sender)
(define-data-var log-counter uint u0)
(define-data-var paused bool false)
(define-data-var max-logs-per-user uint u100)
(define-data-var max-description-len uint u500)
(define-data-var max-notes-len uint u200)

;; Maps
(define-map activity-logs
  { log-id: uint }
  {
    parent: principal,
    child-id: uint,
    activity-type: (string-utf8 50),
    description: (string-utf8 500),
    evidence-hashes: (list 5 (buff 32)),  ;; Support multiple evidence hashes
    timestamp: uint,
    verified: bool,
    verifier: (optional principal),
    dispute-status: bool,
    dispute-notes: (string-utf8 200),
    metadata: (optional (string-utf8 100))  ;; Additional metadata
  }
)

(define-map activities-by-parent
  { parent: principal }
  { log-ids: (list 100 uint) }
)

(define-map activities-by-child
  { child-id: uint }
  { log-ids: (list 100 uint) }
)

(define-map activity-types
  { type-name: (string-utf8 50) }
  { description: (string-utf8 100), active: bool }
)

;; Private functions
(define-private (append-log-id (logs (list 100 uint)) (new-id uint))
  (unwrap! (as-max-len? (append logs new-id) u100) (err ERR-MAX-LOGS_REACHED))
)

(define-private (is-valid-string-len (str (string-utf8 500)) (max-len uint))
  (and (> (len str) u0) (<= (len str) max-len))
)

(define-private (is-contract-owner (caller principal))
  (is-eq caller (var-get contract-owner))
)

;; Public functions

(define-public (set-paused (new-paused bool))
  (if (is-contract-owner tx-sender)
    (begin
      (var-set paused new-paused)
      (ok true)
    )
    (err ERR-UNAUTHORIZED)
  )
)

(define-public (add-activity-type (type-name (string-utf8 50)) (desc (string-utf8 100)))
  (if (is-contract-owner tx-sender)
    (if (is-some (map-get? activity-types {type-name: type-name}))
      (err ERR-INVALID_ACTIVITY_TYPE)  ;; Already exists
      (begin
        (map-set activity-types {type-name: type-name} {description: desc, active: true})
        (ok true)
      )
    )
    (err ERR-UNAUTHORIZED)
  )
)

(define-public (log-activity 
  (child-id uint) 
  (activity-type (string-utf8 50)) 
  (description (string-utf8 500)) 
  (evidence-hashes (list 5 (buff 32))) 
  (metadata (optional (string-utf8 100))))
  (let
    ((caller tx-sender)
     (new-id (+ (var-get log-counter) u1))
     (type-info (map-get? activity-types {type-name: activity-type})))
    (if (var-get paused)
      (err ERR-PAUSED)
      (if (or 
            (not (is-some type-info))
            (not (get active (unwrap! type-info (err ERR-INVALID_ACTIVITY_TYPE))))
            (not (is-valid-string-len description (var-get max-description-len)))
            (is-eq child-id u0))
        (err ERR-INVALID-PARAM)
        (begin
          ;; Assume caller is parent; in full system, check via trait or registry
          (map-set activity-logs {log-id: new-id}
            {
              parent: caller,
              child-id: child-id,
              activity-type: activity-type,
              description: description,
              evidence-hashes: evidence-hashes,
              timestamp: block-height,
              verified: false,
              verifier: none,
              dispute-status: false,
              dispute-notes: "",
              metadata: metadata
            }
          )
          (let
            ((parent-logs (default-to (list) (get log-ids (map-get? activities-by-parent {parent: caller}))))
             (child-logs (default-to (list) (get log-ids (map-get? activities-by-child {child-id: child-id})))))
            (map-set activities-by-parent {parent: caller} {log-ids: (append-log-id parent-logs new-id)})
            (map-set activities-by-child {child-id: child-id} {log-ids: (append-log-id child-logs new-id)})
          )
          (var-set log-counter new-id)
          (print {event: "activity-logged", log-id: new-id, parent: caller, child-id: child-id})
          (ok new-id)
        )
      )
    )
  )
)

(define-public (verify-activity (log-id uint))
  (let
    ((activity (map-get? activity-logs {log-id: log-id}))
     (caller tx-sender))
    (match activity some-act
      (if (or (get verified some-act) (var-get paused))
        (err (if (get verified some-act) ERR-ALREADY_VERIFIED ERR-PAUSED))
        (begin
          ;; Assume caller is educator; in full system, check role
          (map-set activity-logs {log-id: log-id}
            (merge some-act {verified: true, verifier: (some caller)})
          )
          (print {event: "activity-verified", log-id: log-id, verifier: caller})
          (ok true)
        )
      )
      (err ERR-ACTIVITY-NOT-FOUND)
    )
  )
)

(define-public (dispute-activity (log-id uint) (notes (string-utf8 200)))
  (let
    ((activity (map-get? activity-logs {log-id: log-id}))
     (caller tx-sender))
    (match activity some-act
      (if (or (get dispute-status some-act) (var-get paused))
        (err (if (get dispute-status some-act) ERR-ALREADY_DISPUTED ERR-PAUSED))
        (if (not (is-valid-string-len notes (var-get max-notes-len)))
          (err ERR-INVALID_PARAM)
          (begin
            ;; Assume caller has permission (parent or educator)
            (map-set activity-logs {log-id: log-id}
              (merge some-act {dispute-status: true, dispute-notes: notes})
            )
            (print {event: "activity-disputed", log-id: log-id, disputer: caller})
            (ok true)
          )
        )
      )
      (err ERR-ACTIVITY-NOT-FOUND)
    )
  )
)

(define-public (update-activity-description (log-id uint) (new-description (string-utf8 500)))
  (let
    ((activity (map-get? activity-logs {log-id: log-id}))
     (caller tx-sender))
    (match activity some-act
      (if (or (not (is-eq (get parent some-act) caller)) (var-get paused) (get verified some-act))
        (err ERR-UNAUTHORIZED)
        (if (not (is-valid-string-len new-description (var-get max-description-len)))
          (err ERR-INVALID_PARAM)
          (begin
            (map-set activity-logs {log-id: log-id}
              (merge some-act {description: new-description})
            )
            (ok true)
          )
        )
      )
      (err ERR-ACTIVITY-NOT-FOUND)
    )
  )
)

(define-public (add-evidence-to-activity (log-id uint) (new-evidence (buff 32)))
  (let
    ((activity (map-get? activity-logs {log-id: log-id}))
     (caller tx-sender))
    (match activity some-act
      (if (or (not (is-eq (get parent some-act) caller)) (var-get paused) (get verified some-act))
        (err ERR-UNAUTHORIZED)
        (let ((current-hashes (get evidence-hashes some-act)))
          (if (>= (len current-hashes) u5)
            (err ERR-INVALID_EVIDENCE)
            (begin
              (map-set activity-logs {log-id: log-id}
                (merge some-act {evidence-hashes: (append current-hashes new-evidence)})
              )
              (ok true)
            )
          )
        )
      )
      (err ERR-ACTIVITY-NOT-FOUND)
    )
  )
)

;; Read-only functions

(define-read-only (get-activity-details (log-id uint))
  (map-get? activity-logs {log-id: log-id})
)

(define-read-only (get-activities-by-parent (parent principal))
  (get log-ids (map-get? activities-by-parent {parent: parent}))
)

(define-read-only (get-activities-by-child (child-id uint))
  (get log-ids (map-get? activities-by-child {child-id: child-id}))
)

(define-read-only (get-activity-type-info (type-name (string-utf8 50)))
  (map-get? activity-types {type-name: type-name})
)

(define-read-only (is-paused)
  (var-get paused)
)

(define-read-only (get-log-count)
  (var-get log-counter)
)

(define-read-only (get-max-logs-per-user)
  (var-get max-logs-per-user)
)