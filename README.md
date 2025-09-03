# 📊 Blockchain Ledger for Parental Involvement Tracking

Welcome to a transparent and verifiable system for tracking parental involvement in child progress within family support programs! This project uses the Stacks blockchain and Clarity smart contracts to create an immutable ledger that logs parental activities, generates reports on child development, and ensures accountability for educators, parents, and program administrators.

## ✨ Features

🔒 Immutable logging of parental involvement activities (e.g., attendance at meetings, homework help, or volunteer hours)  
📈 Verifiable reports on child progress, shared securely with stakeholders  
👨‍👩‍👧‍👦 Role-based access for parents, educators, and family support coordinators  
🏆 Incentive tokens for active parental participation to encourage engagement  
✅ On-chain verification of reports to prevent fraud or disputes  
🚫 Dispute resolution mechanism for contested logs  
📅 Time-stamped entries for accurate historical tracking  
🔍 Audit trails for program compliance and funding audits  

## 🛠 How It Works

This project addresses the real-world problem of inconsistent parental involvement tracking in family support programs, where traditional systems often lack transparency, leading to disputes, inefficient resource allocation, and reduced program effectiveness. By leveraging blockchain, it provides tamper-proof records that build trust and enable verifiable reporting for better child outcomes.

The system involves 8 smart contracts written in Clarity, modularized for security and scalability:

1. **UserRegistry.clar**: Handles registration and authentication of users (parents, children, educators, admins) with unique IDs and role assignments.  
2. **ActivityLogger.clar**: Logs parental involvement activities, including timestamps, descriptions, and evidence hashes (e.g., photo or document hashes).  
3. **ProgressTracker.clar**: Records child progress milestones, such as academic achievements or behavioral improvements, linked to parental logs.  
4. **ReportGenerator.clar**: Compiles data from logs into verifiable reports, generating a unique hash for each report.  
5. **TokenIncentives.clar**: Manages a custom SIP-10 fungible token (e.g., "InvolveToken") to reward parents for consistent involvement.  
6. **VerificationEngine.clar**: Allows anyone to verify the authenticity of a report or log against the blockchain state.  
7. **AccessControl.clar**: Enforces permissions, ensuring only authorized users can view or modify specific data (e.g., parents can't alter educator logs).  
8. **DisputeResolver.clar**: Facilitates on-chain disputes, where admins can review and resolve contested entries with multi-signature approval.

**For Parents**  
- Register via UserRegistry with your details and link to your child.  
- Log activities using ActivityLogger (e.g., "Attended parent-teacher meeting" with a timestamp).  
- Earn tokens from TokenIncentives for milestones.  
- Generate and share reports via ReportGenerator for program benefits or personal records.  

**For Educators/Family Support Coordinators**  
- Update child progress in ProgressTracker.  
- Verify parental logs using VerificationEngine.  
- Use AccessControl to grant viewing permissions and resolve issues with DisputeResolver.  

**For Verifiers (e.g., Auditors or Funders)**  
- Query any report hash through VerificationEngine to confirm its integrity.  
- Review audit trails across contracts for compliance.  

Deployment is straightforward on Stacks: Deploy the contracts in sequence (starting with UserRegistry), then interact via Clarity functions like `register-user`, `log-activity`, or `generate-report`. All data is stored immutably, ensuring family support programs can provide evidence-based reports for funding, evaluations, or legal needs.

Get started by cloning the repo and deploying to Stacks testnet! 🚀