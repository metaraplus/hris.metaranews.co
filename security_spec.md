# Security Specification: Employee Attendance & Face Recognition App

## 1. Data Invariants
- An attendance document cannot be created for a user other than the authenticated user (`request.auth.uid == incoming().userId`), unless an Admin creates or edits it.
- An employee profile can only be modified by the employee themselves or an authorized HR Admin.
- The `role` field cannot be self-escalated to `admin` by regular users.
- Office geolocation and attendance rules (`settings/{settingId}`) can only be modified by authorized Admins (`isAdmin()`).
- All string inputs must be size-bounded to prevent Denial of Wallet attacks.
- Document IDs must match strict alphanumeric slug regex (`^[a-zA-Z0-9_\-]+$`).
- Admins are verified via existing records in `/admins/{uid}` or pre-bootstrapped authorized admin email `metaraplus.metaranews@gmail.com`.

## 2. The Dirty Dozen Malicious Payloads

1. **Self-Escalation Attack**: Normal employee attempts to update their own `role` to `"admin"`.
2. **Ghost User Attendance Write**: Unauthenticated user attempts to create an attendance document.
3. **Impersonated Clock-In**: Authenticated user Alice creates an attendance with `userId: "bob_uid"` to fake Bob's presence.
4. **Denial-of-Wallet Payload**: Massive 500KB string payload sent to `notes` field in `/attendances/att_1`.
5. **ID Poisoning Attack**: Writing an attendance document to path with slash / script injection `/attendances/../../../root_hack`.
6. **Office Geofence Tampering**: Non-admin employee attempts to write new office coordinates to `/settings/office` with their home location.
7. **Admins Collection Injection**: Normal user attempts to insert their own UID into `/admins/{my_uid}`.
8. **Shadow Field Injection**: Adding arbitrary hidden fields like `_isMasterAdmin: true` to `/employees/{uid}`.
9. **Attendance Modification by Stranger**: User Charlie attempts to delete or overwrite Bob's attendance record.
10. **Spoofed Admin Email**: User with unverified fake email `metaraplus.metaranews@gmail.com` without `email_verified == true`.
11. **Altered Historical Time**: Updating existing attendance record to overwrite `checkInTime` without admin authorization.
12. **Malicious Script Injected in Department**: Setting `department: "<script>alert(1)</script>"` or exceeding character limits.
