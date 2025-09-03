import { describe, expect, it, vi, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface ActivityLog {
  parent: string;
  childId: number;
  activityType: string;
  description: string;
  evidenceHashes: string[]; // Simplified as strings for JS
  timestamp: number;
  verified: boolean;
  verifier: string | null;
  disputeStatus: boolean;
  disputeNotes: string;
  metadata: string | null;
}

interface ActivityType {
  description: string;
  active: boolean;
}

interface ContractState {
  activityLogs: Map<number, ActivityLog>;
  activitiesByParent: Map<string, number[]>;
  activitiesByChild: Map<number, number[]>;
  activityTypes: Map<string, ActivityType>;
  contractOwner: string;
  logCounter: number;
  paused: boolean;
  maxLogsPerUser: number;
  maxDescriptionLen: number;
  maxNotesLen: number;
}

// Mock contract implementation
class ActivityLoggerMock {
  private state: ContractState = {
    activityLogs: new Map(),
    activitiesByParent: new Map(),
    activitiesByChild: new Map(),
    activityTypes: new Map(),
    contractOwner: "deployer",
    logCounter: 0,
    paused: false,
    maxLogsPerUser: 100,
    maxDescriptionLen: 500,
    maxNotesLen: 200,
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_PARAM = 101;
  private ERR_ACTIVITY_NOT_FOUND = 102;
  private ERR_ALREADY_VERIFIED = 103;
  private ERR_ALREADY_DISPUTED = 104;
  private ERR_PAUSED = 105;
  private ERR_INVALID_EVIDENCE = 106;
  private ERR_MAX_LOGS_REACHED = 107;
  private ERR_INVALID_CHILD_ID = 108;
  private ERR_INVALID_ACTIVITY_TYPE = 109;
  private ERR_METADATA_TOO_LONG = 110;

  setPaused(caller: string, newPaused: boolean): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.paused = newPaused;
    return { ok: true, value: true };
  }

  addActivityType(caller: string, typeName: string, desc: string): ClarityResponse<boolean> {
    if (caller !== this.state.contractOwner) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (this.state.activityTypes.has(typeName)) {
      return { ok: false, value: this.ERR_INVALID_ACTIVITY_TYPE };
    }
    this.state.activityTypes.set(typeName, { description: desc, active: true });
    return { ok: true, value: true };
  }

  logActivity(
    caller: string,
    childId: number,
    activityType: string,
    description: string,
    evidenceHashes: string[],
    metadata: string | null
  ): ClarityResponse<number> {
    if (this.state.paused) {
      return { ok: false, value: this.ERR_PAUSED };
    }
    const typeInfo = this.state.activityTypes.get(activityType);
    if (!typeInfo || !typeInfo.active || description.length === 0 || description.length > this.state.maxDescriptionLen || childId === 0) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    const newId = this.state.logCounter + 1;
    this.state.activityLogs.set(newId, {
      parent: caller,
      childId,
      activityType,
      description,
      evidenceHashes,
      timestamp: Date.now(),
      verified: false,
      verifier: null,
      disputeStatus: false,
      disputeNotes: "",
      metadata,
    });
    const parentLogs = this.state.activitiesByParent.get(caller) ?? [];
    if (parentLogs.length >= this.state.maxLogsPerUser) {
      return { ok: false, value: this.ERR_MAX_LOGS_REACHED };
    }
    this.state.activitiesByParent.set(caller, [...parentLogs, newId]);
    const childLogs = this.state.activitiesByChild.get(childId) ?? [];
    if (childLogs.length >= this.state.maxLogsPerUser) {
      return { ok: false, value: this.ERR_MAX_LOGS_REACHED };
    }
    this.state.activitiesByChild.set(childId, [...childLogs, newId]);
    this.state.logCounter = newId;
    return { ok: true, value: newId };
  }

  verifyActivity(caller: string, logId: number): ClarityResponse<boolean> {
    const activity = this.state.activityLogs.get(logId);
    if (!activity) {
      return { ok: false, value: this.ERR_ACTIVITY_NOT_FOUND };
    }
    if (activity.verified || this.state.paused) {
      return { ok: false, value: activity.verified ? this.ERR_ALREADY_VERIFIED : this.ERR_PAUSED };
    }
    // Assume permission
    this.state.activityLogs.set(logId, { ...activity, verified: true, verifier: caller });
    return { ok: true, value: true };
  }

  disputeActivity(caller: string, logId: number, notes: string): ClarityResponse<boolean> {
    const activity = this.state.activityLogs.get(logId);
    if (!activity) {
      return { ok: false, value: this.ERR_ACTIVITY_NOT_FOUND };
    }
    if (activity.disputeStatus || this.state.paused) {
      return { ok: false, value: activity.disputeStatus ? this.ERR_ALREADY_DISPUTED : this.ERR_PAUSED };
    }
    if (notes.length === 0 || notes.length > this.state.maxNotesLen) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    // Assume permission
    this.state.activityLogs.set(logId, { ...activity, disputeStatus: true, disputeNotes: notes });
    return { ok: true, value: true };
  }

  updateActivityDescription(caller: string, logId: number, newDescription: string): ClarityResponse<boolean> {
    const activity = this.state.activityLogs.get(logId);
    if (!activity) {
      return { ok: false, value: this.ERR_ACTIVITY_NOT_FOUND };
    }
    if (activity.parent !== caller || this.state.paused || activity.verified) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (newDescription.length === 0 || newDescription.length > this.state.maxDescriptionLen) {
      return { ok: false, value: this.ERR_INVALID_PARAM };
    }
    this.state.activityLogs.set(logId, { ...activity, description: newDescription });
    return { ok: true, value: true };
  }

  addEvidenceToActivity(caller: string, logId: number, newEvidence: string): ClarityResponse<boolean> {
    const activity = this.state.activityLogs.get(logId);
    if (!activity) {
      return { ok: false, value: this.ERR_ACTIVITY_NOT_FOUND };
    }
    if (activity.parent !== caller || this.state.paused || activity.verified) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (activity.evidenceHashes.length >= 5) {
      return { ok: false, value: this.ERR_INVALID_EVIDENCE };
    }
    this.state.activityLogs.set(logId, { ...activity, evidenceHashes: [...activity.evidenceHashes, newEvidence] });
    return { ok: true, value: true };
  }

  getActivityDetails(logId: number): ClarityResponse<ActivityLog | null> {
    return { ok: true, value: this.state.activityLogs.get(logId) ?? null };
  }

  getActivitiesByParent(parent: string): ClarityResponse<number[] | null> {
    return { ok: true, value: this.state.activitiesByParent.get(parent) ?? null };
  }

  getActivitiesByChild(childId: number): ClarityResponse<number[] | null> {
    return { ok: true, value: this.state.activitiesByChild.get(childId) ?? null };
  }

  getActivityTypeInfo(typeName: string): ClarityResponse<ActivityType | null> {
    return { ok: true, value: this.state.activityTypes.get(typeName) ?? null };
  }

  isPaused(): ClarityResponse<boolean> {
    return { ok: true, value: this.state.paused };
  }

  getLogCount(): ClarityResponse<number> {
    return { ok: true, value: this.state.logCounter };
  }

  getMaxLogsPerUser(): ClarityResponse<number> {
    return { ok: true, value: this.state.maxLogsPerUser };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  parent: "parent_wallet",
  educator: "educator_wallet",
  childId: 1,
};

describe("ActivityLogger Contract", () => {
  let contract: ActivityLoggerMock;

  beforeEach(() => {
    contract = new ActivityLoggerMock();
    vi.resetAllMocks();
  });

  it("should allow owner to add activity type", () => {
    const result = contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    expect(result).toEqual({ ok: true, value: true });
    const typeInfo = contract.getActivityTypeInfo("meeting");
    expect(typeInfo).toEqual({ ok: true, value: { description: "Parent-teacher meeting", active: true } });
  });

  it("should prevent non-owner from adding activity type", () => {
    const result = contract.addActivityType(accounts.parent, "meeting", "Parent-teacher meeting");
    expect(result).toEqual({ ok: false, value: 100 });
  });

  it("should allow parent to log activity after type is added", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    const result = contract.logActivity(
      accounts.parent,
      accounts.childId,
      "meeting",
      "Attended meeting",
      ["hash1"],
      "Extra info"
    );
    expect(result).toEqual({ ok: true, value: 1 });
    const details = contract.getActivityDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({
        parent: accounts.parent,
        childId: accounts.childId,
        activityType: "meeting",
        description: "Attended meeting",
        evidenceHashes: ["hash1"],
        verified: false,
        disputeStatus: false,
        metadata: "Extra info",
      }),
    });
    const parentActivities = contract.getActivitiesByParent(accounts.parent);
    expect(parentActivities).toEqual({ ok: true, value: [1] });
    const childActivities = contract.getActivitiesByChild(accounts.childId);
    expect(childActivities).toEqual({ ok: true, value: [1] });
  });

  it("should prevent logging with invalid parameters", () => {
    const result = contract.logActivity(
      accounts.parent,
      0,
      "invalid",
      "",
      [],
      null
    );
    expect(result).toEqual({ ok: false, value: 101 });
  });

  it("should allow educator to verify activity", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended meeting", [], null);
    const verifyResult = contract.verifyActivity(accounts.educator, 1);
    expect(verifyResult).toEqual({ ok: true, value: true });
    const details = contract.getActivityDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({ verified: true, verifier: accounts.educator }),
    });
  });

  it("should prevent verifying already verified activity", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended meeting", [], null);
    contract.verifyActivity(accounts.educator, 1);
    const secondVerify = contract.verifyActivity(accounts.educator, 1);
    expect(secondVerify).toEqual({ ok: false, value: 103 });
  });

  it("should allow disputing activity", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended meeting", [], null);
    const disputeResult = contract.disputeActivity(accounts.educator, 1, "Incorrect details");
    expect(disputeResult).toEqual({ ok: true, value: true });
    const details = contract.getActivityDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({ disputeStatus: true, disputeNotes: "Incorrect details" }),
    });
  });

  it("should prevent operations when paused", () => {
    contract.setPaused(accounts.deployer, true);
    const logResult = contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended", [], null);
    expect(logResult).toEqual({ ok: false, value: 105 });
  });

  it("should allow updating description before verification", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Old desc", [], null);
    const updateResult = contract.updateActivityDescription(accounts.parent, 1, "New desc");
    expect(updateResult).toEqual({ ok: true, value: true });
    const details = contract.getActivityDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({ description: "New desc" }),
    });
  });

  it("should allow adding evidence before verification", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended", [], null);
    const addResult = contract.addEvidenceToActivity(accounts.parent, 1, "newhash");
    expect(addResult).toEqual({ ok: true, value: true });
    const details = contract.getActivityDetails(1);
    expect(details).toEqual({
      ok: true,
      value: expect.objectContaining({ evidenceHashes: ["newhash"] }),
    });
  });

  it("should prevent adding evidence beyond max", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    contract.logActivity(accounts.parent, accounts.childId, "meeting", "Attended", ["h1", "h2", "h3", "h4", "h5"], null);
    const addResult = contract.addEvidenceToActivity(accounts.parent, 1, "h6");
    expect(addResult).toEqual({ ok: false, value: 106 });
  });

  it("should enforce max logs per user", () => {
    contract.addActivityType(accounts.deployer, "meeting", "Parent-teacher meeting");
    for (let i = 0; i < 100; i++) {
      contract.logActivity(accounts.parent, accounts.childId, "meeting", `Desc ${i}`, [], null);
    }
    const overflowResult = contract.logActivity(accounts.parent, accounts.childId, "meeting", "Overflow", [], null);
    expect(overflowResult).toEqual({ ok: false, value: 107 });
  });
});