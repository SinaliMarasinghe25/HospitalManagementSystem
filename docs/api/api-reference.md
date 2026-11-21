# API reference

The ASP.NET Core API in `backend/Hms.Api` serves everything under `/api`. The React app is its only client. This page lists every endpoint, who may call it, and the conventions they share.

- **Base address in development:** `https://localhost:7019` (through the Vite proxy the browser uses `http://localhost:5173/api/...`).
- **Machine-readable description:** in development, `GET /openapi/v1.json` returns the OpenAPI document.
- **Trying requests by hand:** `backend/Hms.Api/Hms.Api.http` holds ready-made requests for the VS Code REST Client extension. Set `@baseUrl` at its top to the https port your API prints at start-up.
- **Permission names** in the tables are the policies in `Authorization/Policies.cs`. Which roles each one allows is in [Roles and permissions](../architecture/roles-and-permissions.md).

## Conventions

### Login and the cookie

1. `POST /api/auth/login` with `{ "userName": "...", "password": "..." }`.
2. On success the API sets the cookie `hms.auth` (HttpOnly, Secure, SameSite=Strict) and returns the current user. The browser sends the cookie with every later request automatically. JavaScript cannot read it.
3. The session ends after **20 minutes without activity** (sliding). The automatic calls `GET /api/notifications/unread-count` and `GET /api/dashboard` do **not** count as activity.
4. Roles are re-checked every minute, so a deactivated login or changed roles take effect within a minute.

### Status codes

| Code | Meaning |
| --- | --- |
| 200 OK | Success with a body |
| 201 Created | A new patient, appointment, admission, invoice, medical record or employee was created; the body is the new record |
| 204 No Content | Success without a body (logout, change password, mark read, ...) |
| 400 Bad Request | Validation failed. The body is a standard *validation problem*: `{ "title": "...", "errors": { "FieldName": ["message"] } }`. The React forms show each message next to its field. |
| 401 Unauthorized | Not logged in, session expired, or wrong username/password |
| 403 Forbidden | Logged in, but the role may not do this, or the user still has a temporary password (`"Change your temporary password first."`) |
| 404 Not Found | The record does not exist (or the caller may not see it, such as another doctor's appointment) |
| 429 Too Many Requests | More than 5 "forgot password" requests from one address in 15 minutes |

Errors never contain stack traces. They are JSON *ProblemDetails* objects with at least `title` and `status`.

### Data formats

- **JSON** property names are camelCase (`firstName`). Enums travel as text: `"Female"`, `"CheckedIn"`, `"BankTransfer"`.
- **Date-times** are stored and returned in **UTC** (ISO 8601 with `Z`). A date-time sent *without* a zone, such as `"2026-11-20T10:00"`, is read as hospital time (Asia/Colombo, UTC+05:30).
- **Dates** (`fromDate`, `toDate`, `dateOfBirth`) are `YYYY-MM-DD` hospital days. Date ranges include both ends.
- **Money** is a decimal number with 2 places (for example `1500.00`).

### Paging

Long lists are paged. Add `page` (from 1) and `pageSize` (default 20, at most 100; the audit log defaults to 50). A page past the end returns the last page. The answer is:

```json
{ "items": [ ... ], "page": 2, "pageSize": 20, "totalCount": 47 }
```

`GET /api/billing/invoices` adds `"totalBalance"`: the amount still due over **all** pages.

Paged lists: patients, admissions, medical records, lab requests, prescriptions, invoices, leave requests, audit log.

## Endpoints

### Authentication — `/api/auth`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | anyone | Log in. Body `{ userName, password }`. Returns `{ id, userName, email, roles, mustChangePassword }`. Wrong password and unknown user give the same 401 message. 5 failures lock the account for 15 minutes. |
| POST | `/api/auth/logout` | logged in | Log out (204). |
| GET | `/api/auth/me` | logged in | The current user, same shape as login. 401 when not logged in. |
| POST | `/api/auth/change-password` | logged in | Body `{ currentPassword, newPassword }`. Clears the temporary-password flag. |
| POST | `/api/auth/forgot-password` | anyone (rate-limited) | Body `{ userName }`. Always 204. If the account exists and is active, the administrators get a notification to reset it. |

Password rules: at least 8 characters, with an upper-case letter, a lower-case letter, a digit and a symbol.

### Dashboard and notifications

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dashboard` | logged in | The dashboard tiles the caller's roles may see. Not cached. |
| GET | `/api/notifications` | logged in | The caller's newest 20 notifications and the unread count. |
| GET | `/api/notifications/unread-count` | logged in | `{ count }` for the bell. |
| POST | `/api/notifications/{id}/read` | logged in | Mark one as read (only your own). |
| POST | `/api/notifications/read-all` | logged in | Mark all of yours as read. |

### Patients — `/api/patients`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/patients?search=&page=&pageSize=` | ViewPatients | Search by name, patient number, phone or national ID. Paged. |
| GET | `/api/patients/{id}` | ViewPatients | Patient details. |
| POST | `/api/patients` | EditPatients | Register a patient. Gets the next number `P-000001`. |
| PUT | `/api/patients/{id}` | EditPatients | Update details. |
| GET | `/api/patients/{id}/history` | ViewMedicalHistory | Medical history: visits, diagnoses, prescriptions, lab results, admissions. Each view is written to the audit log. |
| GET | `/api/patients/{id}/documents` | ViewPatientDocuments | List documents. |
| POST | `/api/patients/{id}/documents` | UploadPatientDocuments | Upload as `multipart/form-data` (`file`, optional `description`). PDF, JPG or PNG, at most 5 MB, checked by extension and file content. |
| GET | `/api/patients/{id}/documents/{documentId}` | ViewPatientDocuments | Download. Audited. |

Patient body: `firstName`, `lastName`, `dateOfBirth`, `gender`, `phone` (required), `nationalId`, `email`, `address`, `bloodGroup`, `allergies`, `emergencyContactName`, `emergencyContactPhone`.

### Doctors and departments

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/doctors?departmentId=&search=&includeInactive=` | ViewDoctors | List doctors. |
| GET | `/api/doctors/{id}` | ViewDoctors | Doctor with weekly schedule. |
| PUT | `/api/doctors/{id}/schedule` | ManageDoctors | Replace the weekly schedule: `{ items: [{ dayOfWeek, startTime, endTime }] }`. |
| GET | `/api/departments?includeInactive=` | ViewDoctors | List departments. |
| POST | `/api/departments` | ManageStaff | Add: `{ name, description, isActive, isClinical }`. |
| PUT | `/api/departments/{id}` | ManageStaff | Edit. Administration cannot be renamed or deactivated. |

Doctors are created and edited as employees (see Staff below). `POST /api/doctors` does not exist.

### Appointments — `/api/appointments`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/appointments?fromDate=&toDate=&doctorId=&patientId=&status=` | ViewAppointments | Appointments in a date range (calendar; not paged). A doctor gets only their own. |
| GET | `/api/appointments/{id}` | ViewAppointments | One appointment. |
| GET | `/api/appointments/slots?doctorId=&date=&ignoreAppointmentId=` | BookAppointments | Free and taken slots for a doctor on a day, from their schedule. |
| POST | `/api/appointments` | BookAppointments | Book: `{ patientId, doctorId, startTime, reason }`. Must be a free slot in the future. |
| POST | `/api/appointments/{id}/reschedule` | BookAppointments | `{ startTime, doctorId }`. The old one becomes *Rescheduled* and links to the new one. |
| POST | `/api/appointments/{id}/cancel` | BookAppointments | `{ reason }` (required). The slot becomes free. |
| PUT | `/api/appointments/{id}/status` | UpdateAppointmentStatus | `{ status }`: `CheckedIn`, `NoShow` or `Completed`, with the rules in [Roles and permissions](../architecture/roles-and-permissions.md#rules-that-go-beyond-the-table). Completing adds the consultation charge. |

### Medical records and prescriptions

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/medical-records?fromDate=&toDate=&patientId=&doctorId=&page=` | ViewMedicalHistory | Visits, paged. |
| GET | `/api/medical-records/{id}` | ViewMedicalHistory | One visit with diagnoses, treatments, prescriptions. Audited. Also feeds the printable medical report. |
| POST | `/api/medical-records` | EditMedicalRecords | Write the visit for an appointment: `{ appointmentId, chiefComplaint, clinicalNotes, diagnoses: [...], treatments: [...] }`. Own doctor only. |
| PUT | `/api/medical-records/{id}` | EditMedicalRecords | Change it (the doctor who wrote it). |
| POST | `/api/medical-records/{id}/prescriptions` | EditMedicalRecords | Prescribe: `{ items: [{ medicineId, dosage, frequency, durationDays, quantity, instructions }] }`. Pharmacists are notified. |
| GET | `/api/prescriptions?status=&patientId=&open=&page=` | ViewPrescriptions | Prescriptions, paged. `open=true` is the pharmacy queue, oldest first. |
| GET | `/api/prescriptions/{id}` | ViewPrescriptions | One prescription. |
| POST | `/api/prescriptions/{id}/cancel` | EditMedicalRecords | The prescribing doctor cancels it before dispensing starts. |
| GET | `/api/medicines?search=` | ViewPrescriptions | Medicine picker for prescribing. |

### Admissions and wards

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/wards` | ViewAdmissions | Wards with beds and who is in each bed (bed board). |
| POST | `/api/wards` | ManageWards | Add: `{ name, wardType, dailyCharge }`. |
| PUT | `/api/wards/{id}` | ManageWards | Edit. |
| POST | `/api/wards/{id}/beds` | ManageWards | Add beds: `{ prefix, count }`. |
| PUT | `/api/wards/beds/{bedId}/status` | ManageWards | Take a bed in or out of use: `{ isActive }`. |
| GET | `/api/admissions?status=&fromDate=&toDate=&wardId=&patientId=&page=` | ViewAdmissions | Admissions, paged (current inpatients by default). |
| GET | `/api/admissions/{id}` | ViewAdmissions | One admission. Clinical details only for clinical roles (audited). |
| POST | `/api/admissions` | AdmitPatients | Admit: `{ patientId, bedId, admittingDoctorId, admissionReason }`. One open admission per patient and per bed. |
| POST | `/api/admissions/{id}/transfer` | TransferPatients | `{ toBedId, reason }`. |
| POST | `/api/admissions/{id}/discharge` | DischargePatients | `{ dischargeSummary }`. Adds the bed charges: each started 24 hours is one bed-day (at least one), priced at the daily charge of the ward the patient was in at the start of that day. |
| GET | `/api/admissions/{id}/vitals` | ViewMedicalHistory | Vital signs. |
| POST | `/api/admissions/{id}/vitals` | RecordVitals | `{ temperatureC, pulseBpm, systolicBp, diastolicBp, respiratoryRate, oxygenSaturation, notes }`. |

### Laboratory — `/api/lab`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/lab/tests?includeInactive=` | ViewLabRequests | Test catalogue. |
| POST | `/api/lab/tests` | ManageLabTests | Add a test: `{ code, name, price, unit, referenceRange, isActive }`. |
| PUT | `/api/lab/tests/{id}` | ManageLabTests | Edit a test. |
| GET | `/api/lab/requests?status=&fromDate=&toDate=&patientId=&medicalRecordId=&page=` | ViewLabRequests | Requests, paged. `status=Requested` is the queue, oldest first. |
| GET | `/api/lab/requests/{id}` | ViewLabRequests | One request with its result. Audited. Feeds the printable lab report. |
| POST | `/api/lab/requests` | RequestLabTests | Order tests: `{ patientId, medicalRecordId, labTestIds: [...] }`. Lab staff are notified. |
| POST | `/api/lab/requests/{id}/cancel` | RequestLabTests | The requesting doctor cancels it. |
| POST | `/api/lab/requests/{id}/sample` | ProcessLabRequests | `{ sampleId }` (unique). Status becomes *SampleCollected*. |
| PUT | `/api/lab/requests/{id}/result` | ProcessLabRequests | `{ resultValue, resultNotes, isAbnormal }`. Status becomes *Completed*, the test price is charged, and the doctor is notified. Can be sent again to correct a result. |

### Pharmacy — `/api/pharmacy`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/pharmacy/medicines?search=&includeInactive=` | ViewPharmacyStock | Medicines with stock. Cost prices only for Admin, Pharmacist, Accountant. |
| GET | `/api/pharmacy/medicines/{id}` | ViewPharmacyStock | Medicine with batches and recent stock movements. |
| POST | `/api/pharmacy/medicines` | ManagePharmacyStock | Add: `{ name, genericName, form, strength, unitPrice, reorderLevel, isActive }`. |
| PUT | `/api/pharmacy/medicines/{id}` | ManagePharmacyStock | Edit. |
| PUT | `/api/pharmacy/medicines/{id}/price` | EditMedicinePrices | Change the selling price: `{ unitPrice }`. |
| POST | `/api/pharmacy/medicines/{id}/stock-in` | ManagePharmacyStock | Receive a batch: `{ batchNumber, expiryDate, quantity, costPrice }`. |
| POST | `/api/pharmacy/batches/{batchId}/adjust` | ManagePharmacyStock | `{ quantityChange, reason }`. Stock can never go below zero. |
| POST | `/api/pharmacy/batches/{batchId}/write-off` | ManagePharmacyStock | Write off an expired batch. |
| GET | `/api/pharmacy/alerts` | ViewPharmacyStock | Low stock (below reorder level), near expiry (within 90 days), expired. |
| GET | `/api/pharmacy/prescriptions/{id}` | ViewPrescriptions | A prescription with usable stock per medicine and what was handed over. |
| POST | `/api/pharmacy/prescriptions/{id}/dispense` | DispenseMedicines | `{ items: [{ prescriptionItemId, quantity }] }`. Takes the batches that expire first, never expired ones, and adds the pharmacy charge in the same transaction. Part dispensing is allowed. |

### Billing — `/api/billing`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/billing/unbilled` | ViewInvoiceDetails | Patients with charges not yet on an invoice. |
| GET | `/api/billing/unbilled/{patientId}` | ViewInvoiceDetails | That patient's unbilled charges. |
| GET | `/api/billing/invoices?status=&due=&patientId=&search=&fromDate=&toDate=&page=` | ViewInvoiceBalances | Invoices, paged, with `totalBalance`. `due=true` is everything still to be paid. |
| GET | `/api/billing/invoices/{id}` | ViewInvoiceDetails | Invoice with lines and payments (also the printable invoice). |
| POST | `/api/billing/invoices` | ManageBilling | Generate an invoice: `{ patientId, chargeIds: [...], discount }`. Number `INV-000001`. The discount cannot exceed the subtotal; a charge can be on only one invoice. |
| POST | `/api/billing/invoices/{id}/cancel` | ManageBilling | Cancel while nothing is paid. Its charges become unbilled again. |
| POST | `/api/billing/invoices/{id}/payments` | ManageBilling | `{ amount, method, referenceNumber }`. Method `Cash`, `Card` or `BankTransfer`; card and transfer need a reference. No overpayment. Returns the receipt (`RCP-000001`). |
| GET | `/api/billing/payments/{paymentId}/receipt` | ViewInvoiceDetails | Reprint a receipt (shows the balance as it was at that payment). |

### Staff — `/api/staff`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/staff/employees?search=&departmentId=&includeInactive=` | ManageStaff | Employees. |
| GET | `/api/staff/employees/{id}` | ManageStaff | One employee with doctor profile and login. |
| POST | `/api/staff/employees` | ManageStaff | Add an employee (`EMP-0001`). Body: `firstName`, `lastName`, `jobTitle`, `phone`, `email`, `hireDate`, `departmentId`, `isActive`, optional `doctor: { specialization, licenseNumber, consultationFee, slotMinutes }`, optional new login `userName`, `password`, `roles`. Non-clinical staff go to Administration. |
| PUT | `/api/staff/employees/{id}` | ManageStaff | Edit. |
| POST | `/api/staff/employees/{id}/login` | ManageStaff | Create a login for an employee: `{ userName, password, roles }`. The password is temporary. |
| PUT | `/api/staff/employees/{id}/login` | ManageStaff | Link an existing login `{ userId }`, or unlink with `{ userId: null }`. |
| GET | `/api/staff/unlinked-users` | ManageStaff | Logins not linked to an employee. |
| GET | `/api/staff/attendance?date=` | ManageStaff | The attendance sheet for a day. |
| PUT | `/api/staff/attendance` | ManageStaff | Save a day: `{ date, entries: [{ employeeId, status, checkIn, checkOut }] }`. |
| GET | `/api/staff/employees/{id}/attendance?fromDate=&toDate=` | ManageStaff | One employee's attendance. |
| GET | `/api/staff/leave?status=&page=` | ManageStaff | Leave requests, paged. |
| POST | `/api/staff/leave` | ManageStaff | Record leave for an employee: `{ employeeId, leaveType, startDate, endDate, reason }`. |
| POST | `/api/staff/leave/{id}/approve` | ManageStaff | `{ note }` (optional). The employee is notified. |
| POST | `/api/staff/leave/{id}/reject` | ManageStaff | `{ note }` (required). |
| GET | `/api/staff/my/leave` | logged in | Your own leave requests. |
| POST | `/api/staff/my/leave` | logged in | Request leave: `{ leaveType, startDate, endDate, reason }`. Administrators are notified. |
| POST | `/api/staff/my/leave/{id}/cancel` | logged in | Withdraw your pending request. |

### Logins — `/api/users` (Administrator role)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/users` | All logins with roles, status and linked employee. |
| PUT | `/api/users/{id}/roles` | `{ roles: [...] }`. A doctor's login always keeps the Doctor role. |
| POST | `/api/users/{id}/reset-password` | `{ newPassword }`. Temporary: the user must change it at the next login. |
| PUT | `/api/users/{id}/status` | `{ isActive }`. Logins are deactivated, never deleted. |

### Reports — `/api/reports`

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/reports/patients?fromDate=&toDate=` | ViewPatientReport | Registrations in a period. |
| GET | `/api/reports/appointments?fromDate=&toDate=&doctorId=&status=` | ViewAppointmentReport | Appointments by doctor and status. A doctor sees only their own. |
| GET | `/api/reports/revenue?fromDate=&toDate=` | ViewRevenue | Billed by source (invoices issued in the period), collected by method and by day (totals match the payments), outstanding now. |
| GET | `/api/reports/pharmacy?fromDate=&toDate=` | ViewPharmacyReport | Dispensed items in the period; stock, low stock and expiry as of now. |
| GET | `/api/reports/laboratory?fromDate=&toDate=&labTestId=&status=` | ViewLabReport | Tests by type and status. |
| GET | `/api/reports/staff?year=&month=&departmentId=` | ManageStaff | Attendance and leave per employee for a month. |

### Audit log — `/api/audit-log` (ViewAuditLog)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/audit-log?fromDate=&toDate=&user=&action=&entityName=&entityId=&page=&pageSize=` | Search the log, newest first. `action` is one of `Login`, `LoginFailed`, `Logout`, `Create`, `Update`, `Delete`, `View`. |
| GET | `/api/audit-log/entity-names` | The record types that appear in the log, for the filter. |

There is no endpoint that changes or deletes audit entries.
