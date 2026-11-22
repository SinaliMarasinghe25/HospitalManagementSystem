# User manual

How hospital staff use the HMS, role by role. Every screen works in Chrome, Edge and Firefox, on a desktop or a phone-sized screen. Use fictitious data only: this is a demonstration system.

## For everyone

### Logging in and out

1. Open the HMS address (in development, http://localhost:5173).
2. Enter your **username** and **password** and click **Login**.
3. If an administrator just created your account or reset your password, you must **choose a new password** before you can continue. It needs at least 8 characters, with an upper-case letter, a lower-case letter, a number and a symbol.
4. When you leave the computer, click your **name** at the top right and choose **Logout**.

- After **20 minutes without activity** you are logged out automatically and see a "session expired" note. Just log in again.
- **5 wrong passwords** lock your account for 15 minutes.
- **Forgot your password?** Click **Forgot password** on the login page and enter your username. An administrator gets a message and will give you a temporary password.
- **Change your password** at any time: click your **name** at the top right, then **Change password**.

### Finding your way

- The **sidebar** on the left shows only the modules your role can use, grouped under Overview, Clinical and Administration. Your name and roles are at the bottom. On a phone or tablet, open it with the menu button (three lines) at the top left.
- The **Dashboard** shows the numbers that matter for your role and refreshes itself every 30 seconds.
- The **bell** at the top right shows notifications meant for you: a new prescription, a lab result, a leave decision and so on. Click one to open the page it is about. **Mark all as read** clears the count.
- Long lists show 20 rows at a time with **Previous** and **Next** under the table.
- Every role can request leave under **Staff → My leave**: choose the leave type, first and last day, and a reason. You can withdraw a request while it is still pending. You are notified when it is approved or rejected.
- **Reports** shows the reports your role may use. Pick the dates, then **Print report** (or save it as a PDF from the print window).

If a button you expect is missing, your role is not allowed to do that action. See [Roles and permissions](../architecture/roles-and-permissions.md).

---

## Receptionist

**Your menu:** Dashboard, Patients, Doctors, Appointments, Admissions, Billing, Staff (My leave), Reports (Appointments).

### Register a patient
1. **Patients → Register patient**.
2. Fill in name, date of birth, gender and phone (required), and the other details you have. Check allergies carefully.
3. Save. The patient gets a number such as `P-000123`.

**Find a patient:** type part of a name, patient number, phone or NIC into the search box on **Patients**.
**Edit details:** open the patient and click **Edit patient**.
**Upload a document** (referral letter, ID copy): open the patient, **Documents → Upload**. PDF, JPG or PNG, up to 5 MB.

### Book an appointment
1. **Appointments → Book appointment** (or from the patient's page).
2. Choose the patient and the doctor, then the date. The free slots from the doctor's schedule appear.
3. Pick a slot, add the reason, and save. The doctor gets a notification.

- **Calendar:** switch between **Day** and **Week**, and filter by doctor or status.
- **Reschedule:** open the appointment → **Reschedule** → choose a new slot (another doctor is possible). The old booking stays in the history as *Rescheduled*.
- **Cancel:** open the appointment → **Cancel appointment** → enter the reason. The slot becomes free again.
- **Check in** the patient when they arrive (on the day itself). Mark **No-show** if they did not come (after the appointment time).

### Admit a patient
**Admissions → Admit patient**: choose the patient, a free bed and the admitting doctor, and enter the reason. The nurses and the doctor are notified.

### Tell a patient what they owe
**Billing → Balance due** lists unpaid invoices with the balance. Receptionists see balances only, not the invoice lines; the accountant takes the payment.

---

## Doctor

**Your menu:** Dashboard, Patients, Doctors, Appointments, Medical Records, Admissions, Laboratory, Pharmacy (stock), Staff (My leave), Reports (Patients, Appointments, Laboratory).

### See your patients
- **Appointments** and the dashboard show **your own** appointments only.
- Open a patient to see the **Medical history**: earlier visits, diagnoses, prescriptions, lab results and admissions, newest first. Every time you open it, the audit log records it.

### Write a consultation
1. Open the checked-in appointment → **Start consultation**.
2. Enter the chief complaint, examination and notes, diagnoses (mark the primary one) and treatments.
3. **Save medical record**.
4. On the record, add a **New prescription**: medicine, dose, how often, days, quantity and instructions → **Save prescription**. The pharmacists are notified.
5. **Request tests** from the record to order lab tests. The lab is notified.
6. Go back to the appointment and click **Complete**. This adds your consultation fee to the patient's bill.

Only you can change your own records, prescriptions and test requests. You can cancel a prescription before the pharmacy starts dispensing, and cancel a test before the sample is taken.

- **Lab results:** you get a notification when a result is ready (and whether it is marked abnormal). **Laboratory → All requests (7 days)** lists recent requests. **Print lab report** gives a clean printable page.
- **Medical report:** open a medical record and print the medical report.

### Inpatients
- **Admit** a patient as above.
- On the admission page you can **Transfer bed**, record **vital signs and nursing notes**, and **Discharge** with a discharge summary. Discharge adds the bed charges; **Print discharge summary** gives the printable summary.

---

## Nurse

**Your menu:** Dashboard, Patients, Doctors, Appointments, Medical Records, Admissions, Laboratory, Staff (My leave), Reports (Patients).

- **Patients and records:** find patients, read their medical history and medical records (read only).
- **Appointments:** see all appointments in the day or week calendar.
- **Admissions:** the **Bed board** shows every ward with free and occupied beds; **Current inpatients** lists who is admitted. You are notified when a patient is admitted.
- **Vital signs:** open an admission → **Vital signs and nursing notes** → enter temperature, pulse, blood pressure, respiratory rate, oxygen saturation and a note.
- **Transfer bed:** open the admission → **Transfer bed** → choose a free bed and give the reason.
- **Lab results:** **Laboratory** shows requests and results (read only).

---

## Laboratory Staff

**Your menu:** Dashboard, Laboratory, Staff (My leave), Reports (Laboratory).

1. **Laboratory → Waiting for sample** is your queue, oldest first. You are notified of new requests.
2. Open a request → **Record sample collection** → enter the sample ID (on the tube label). It moves to **Sample collected**.
3. When the result is ready, open it → **Enter result**: the value, notes, and tick *abnormal* if it is outside the reference range → **Save result**. The test fee is charged and the doctor is notified.
4. A wrong result can be fixed with **Correct the result**; the doctor is told it was corrected.
5. **Print lab report** prints the result with the reference range.

---

## Pharmacist

**Your menu:** Dashboard, Pharmacy, Staff (My leave), Reports (Pharmacy).

### Dispense a prescription
1. **Pharmacy → Prescriptions to dispense** lists open prescriptions, oldest first. You are notified of new ones.
2. Open one. For each medicine you see the prescribed quantity, what is in stock and what was already given.
3. Enter the quantity to **give now** for each line → **Dispense**. Part dispensing is fine; the prescription stays open as *Partly dispensed*.

The system takes stock from the batches that expire first, never from expired batches, and adds the medicine charge to the patient's bill in the same step.

### Manage stock
- **Stock** lists all medicines with usable stock, reorder level and next expiry. **Add medicine** adds a new one (name, generic name, form, strength, selling price, reorder level).
- Open a medicine → **Stock in** to receive a delivery: batch number, expiry date, quantity, cost per unit.
- **Adjust** a batch for breakage or a count difference (with a reason). Stock can never go below zero.
- **Write off** an expired batch.
- **Alerts** lists low stock (below the reorder level), batches expiring within 90 days, and expired batches. You get a notification when a medicine falls below its reorder level.

---

## Accountant

**Your menu:** Dashboard, Pharmacy (stock value and prices), Billing, Staff (My leave), Reports (Revenue).

Charges are added to a patient's bill automatically: consultation fees when an appointment is completed, test prices when a lab result is entered, medicine prices when dispensed, and bed charges at discharge.

### Generate an invoice
1. **Billing → Ready to bill** lists patients with charges not yet invoiced.
2. Open a patient (**Generate bill**), tick the charges to include, enter a discount if any → **Generate invoice**. It gets a number such as `INV-000045`.
3. **Print invoice** gives the printable invoice.

### Receive a payment
1. **Billing → Balance due**, open the invoice → **Receive payment**.
2. Enter the amount, the method (Cash, Card or Bank transfer) and, for card or transfer, the slip or transfer reference → **Record payment**.
3. **Print the receipt**. Part payments are allowed; the invoice shows *Partially paid* until the balance is zero.

- **Cancel invoice** is possible only while nothing has been paid. Its charges go back to *Ready to bill*.
- "Total still due" at the top of **Balance due** is the total over all pages.
- **Pharmacy:** see stock value and change a medicine's selling price.
- **Revenue report:** for a period, what was billed by source (consultation, laboratory, pharmacy, admission) and discounts, what was collected by payment method and by day, and what is still outstanding.

---

## Administrator

**Your menu:** everything.

### People and logins (Staff)
- **Staff → Employees → Add employee** for everyone, doctors included.
  - Tick **Clinical staff** for doctors, nurses, lab staff, pharmacists and others who care for patients, then choose a clinical department. Office staff go to *Administration* automatically.
  - Tick **This person is a doctor** to add the specialisation, licence number, consultation fee and slot length.
  - Optionally create the **login** at the same time: username, temporary password and roles.
- **Staff → Logins:** change roles, **Reset password** (gives a temporary password the person must change), **Deactivate** or **Activate**. Accounts are never deleted. You cannot remove your own Administrator role, and the last active administrator cannot be removed.
- **Password reset requests** from the login page arrive as notifications.
- **Departments:** add or rename departments and mark them clinical or non-clinical.
- **Attendance:** choose the day, mark each employee Present, Absent, Late or On leave, with times → **Save**.
- **Leave requests:** approve (note optional) or reject (note required). The employee is notified.

### Hospital set-up
- **Doctors →** open a doctor → set the weekly **schedule** (days and hours). Bookings use it.
- **Admissions → Manage wards:** add wards with a daily charge, **Add beds**, and **Take out of use** a bed under repair.
- **Laboratory → Test catalogue and prices:** add tests and edit prices and reference ranges.
- **Pharmacy:** change medicine selling prices.

### Oversight
- The dashboard shows every tile, including revenue and pharmacy alerts.
- **Reports:** all six reports.
- **Audit Log:** every login, failed login, logout, change, and every view of medical history, records, lab results and documents, with user, time and IP address. Filter by date, user, action, record type and record ID. Entries cannot be changed or deleted.
- Administrators can view, admit, transfer and discharge, but **cannot write medical records** (doctors only), **dispense** (pharmacists only) or **take payments** (accountants only).
