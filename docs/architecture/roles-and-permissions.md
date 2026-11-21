# Roles and permissions

The HMS has seven roles (PDF section 2). A login can hold **several** roles; it then gets everything each of its roles allows.

| Role | In one sentence |
| --- | --- |
| Administrator | Runs the system: people, logins, departments, wards, prices, reports and the audit log. Sees clinical records but does not write them. |
| Doctor | Sees their own appointments, writes consultations, prescribes, orders lab tests, admits and discharges. |
| Nurse | Sees patients, appointments and records; records vital signs and moves inpatients between beds. |
| Receptionist | Registers patients, books appointments, admits patients, and can tell a patient what they still owe. Cannot see diagnoses. |
| Laboratory Staff | Works the lab queue: collects samples and enters results. |
| Pharmacist | Manages medicine stock and dispenses prescriptions. |
| Accountant | Bills patients, records payments, sees revenue, and can change medicine prices. |

## Where the rules live

The rules are written **once** on the server and **mirrored** in the browser:

- **Server (the real protection):** `backend/Hms.Api/Authorization/Policies.cs` defines 36 named permissions (policies). Every controller action names the policy it needs, for example `[Authorize(Policy = Policies.EditPatients)]`. Anything without a policy still needs a logged-in user, because the fallback policy requires authentication. A request without permission gets **403 Forbidden**; a request without a login gets **401 Unauthorized**.
- **Browser (convenience only):** `frontend/src/auth/permissions.ts` has the same table, so menus and buttons only show what the API will allow. `frontend/src/navigation.ts` decides the sidebar. Hiding a button is not security: the API checks every request again.
- **Tests keep them identical:** `RolePermissionTests` checks all 36 × 7 combinations against the plan, and the frontend test `permissions.test.ts` reads `Policies.cs` and fails if `permissions.ts` differs.

To change a permission, change `Policies.cs`, `permissions.ts` and the expected table in `tests/Hms.Api.Tests/Unit/RolePermissionTests.cs` together.

## Permission table

| Permission (policy) | Allows | Admin | Doctor | Nurse | Recep. | Lab | Pharm. | Acct. |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ViewPatients` | Find patients, see their details | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `EditPatients` | Register and edit patients | ✓ |  |  | ✓ |  |  |  |
| `ViewMedicalHistory` | Read diagnoses, treatments, medical records, vital signs | ✓ | ✓ | ✓ |  |  |  |  |
| `ViewPatientDocuments` | List and download a patient's documents | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `UploadPatientDocuments` | Upload a patient document | ✓ | ✓ |  | ✓ |  |  |  |
| `ViewDoctors` | See doctors, schedules and departments | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `ManageDoctors` | Change a doctor's weekly schedule | ✓ |  |  |  |  |  |  |
| `ViewAppointments` | See appointments (a doctor sees only their own) | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `BookAppointments` | Book, reschedule and cancel appointments | ✓ |  |  | ✓ |  |  |  |
| `UpdateAppointmentStatus` | Check in, no-show, complete (with extra rules below) | ✓ | ✓ |  | ✓ |  |  |  |
| `EditMedicalRecords` | Write consultations, prescriptions; cancel own prescriptions |  | ✓ |  |  |  |  |  |
| `ViewPrescriptions` | See prescriptions | ✓ | ✓ | ✓ |  |  | ✓ |  |
| `ViewAdmissions` | See the bed board, wards and admissions | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `AdmitPatients` | Admit a patient to a bed | ✓ | ✓ |  | ✓ |  |  |  |
| `TransferPatients` | Move an inpatient to another bed | ✓ | ✓ | ✓ |  |  |  |  |
| `RecordVitals` | Record vital signs | ✓ | ✓ | ✓ |  |  |  |  |
| `DischargePatients` | Discharge with a summary | ✓ | ✓ |  |  |  |  |  |
| `ManageWards` | Add and edit wards and beds | ✓ |  |  |  |  |  |  |
| `ViewLabRequests` | See lab requests and results | ✓ | ✓ | ✓ |  | ✓ |  |  |
| `RequestLabTests` | Order and cancel lab tests |  | ✓ |  |  |  |  |  |
| `ProcessLabRequests` | Collect samples, enter results |  |  |  |  | ✓ |  |  |
| `ManageLabTests` | Edit the lab test catalogue and prices | ✓ |  |  |  |  |  |  |
| `ViewPharmacyStock` | See medicines, stock and alerts | ✓ | ✓ |  |  |  | ✓ | ✓ |
| `ManagePharmacyStock` | Add medicines, stock in, adjust, write off |  |  |  |  |  | ✓ |  |
| `DispenseMedicines` | Dispense prescriptions |  |  |  |  |  | ✓ |  |
| `EditMedicinePrices` | Change a medicine's selling price | ✓ |  |  |  |  | ✓ | ✓ |
| `ViewInvoiceBalances` | See invoices and what is still owed | ✓ |  |  | ✓ |  |  | ✓ |
| `ViewInvoiceDetails` | See unbilled charges, invoice lines, receipts | ✓ |  |  |  |  |  | ✓ |
| `ManageBilling` | Create and cancel invoices, record payments |  |  |  |  |  |  | ✓ |
| `ViewRevenue` | Revenue tile and revenue report | ✓ |  |  |  |  |  | ✓ |
| `ManageStaff` | Employees, departments, logins, attendance, leave, staff report | ✓ |  |  |  |  |  |  |
| `ViewPatientReport` | Patient report | ✓ | ✓ | ✓ |  |  |  |  |
| `ViewAppointmentReport` | Appointment report (a doctor sees only their own) | ✓ | ✓ |  | ✓ |  |  |  |
| `ViewPharmacyReport` | Pharmacy report | ✓ |  |  |  |  | ✓ |  |
| `ViewLabReport` | Laboratory report | ✓ | ✓ |  |  | ✓ |  |  |
| `ViewAuditLog` | Read the audit log | ✓ |  |  |  |  |  |  |

## Rules that go beyond the table

Some checks depend on *which* record it is, not only on the role. They are enforced in the services.

**Appointments**
- A doctor (without another role that sees all) sees only **their own** appointments, also in the appointment report and on the dashboard. Administrators, nurses and receptionists see all.
- Check in: only on the day of the appointment, by reception, an administrator or the appointment's own doctor.
- No-show: only after the start time, by reception, an administrator or the own doctor.
- Complete: only a checked-in appointment, by the own doctor or an administrator. Completing adds the doctor's consultation fee to the patient's unbilled charges.
- Allowed steps: Scheduled → Checked in → Completed, Scheduled → No-show. Cancel and reschedule have their own actions. Completed, No-show, Cancelled and Rescheduled are final.

**Medical records, prescriptions, lab tests**
- Only the appointment's own doctor can write its medical record, and only the doctor who wrote a record can change it, prescribe on it or order tests on it.
- Only the doctor who requested a lab test can cancel it, and only the doctor who prescribed can cancel a prescription.

**Pharmacy**
- Doctors see stock but **not cost prices**. Cost prices are shown to administrators, pharmacists and accountants.
- Administrators see the dispensing queue but cannot dispense.

**Billing**
- Receptionists see invoice **balances** (to tell a patient what is owed) but not line items, unbilled charges or receipts.

**Logins**
- An administrator cannot remove their own Administrator role or deactivate their own login, and the last active administrator cannot lose the role or be deactivated. Changed roles take effect within a minute (the user's security stamp is renewed).
- A login with a temporary password (new account or reset by an administrator) can only call `me`, `change-password`, `logout` and `login` until the user chooses their own password.
- Every role may see and request its own leave (Staff → My leave). Only administrators review leave.

**Notifications**
- Each person sees only their own notifications. A notification only contains what its reader's role may already see; its link opens a page that checks permissions as usual.

## Sidebar per role

| Menu item | Admin | Doctor | Nurse | Recep. | Lab | Pharm. | Acct. |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Patients | ✓ | ✓ | ✓ | ✓ |  |  |  |
| Doctors | ✓ | ✓ | ✓ | ✓ |  |  |  |
| Appointments | ✓ | ✓ | ✓ | ✓ |  |  |  |
| Medical Records | ✓ | ✓ | ✓ |  |  |  |  |
| Admissions | ✓ | ✓ | ✓ | ✓ |  |  |  |
| Laboratory | ✓ | ✓ | ✓ |  | ✓ |  |  |
| Pharmacy | ✓ | ✓ |  |  |  | ✓ | ✓ |
| Billing | ✓ |  |  | ✓ |  |  | ✓ |
| Staff (others: My leave only) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reports (each sees only their reports) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Audit Log | ✓ |  |  |  |  |  |  |

## Dashboard tiles per role

| Tile | Admin | Doctor | Nurse | Recep. | Lab | Pharm. | Acct. |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Total patients | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Today's appointments | ✓ | ✓ (own) | ✓ | ✓ |  |  |  |
| Laboratory requests | ✓ | ✓ |  |  | ✓ |  |  |
| Pharmacy alerts | ✓ |  |  |  |  | ✓ |  |
| Revenue summary | ✓ |  |  |  |  |  | ✓ |

"Total patients" is shown to every role (a change from the plan made in step 25): it is a single number with no names. To follow the plan exactly, remove it for Laboratory Staff, Pharmacist and Accountant in `DashboardService.cs`.
