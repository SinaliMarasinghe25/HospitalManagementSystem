using System.Text.Json;
using System.Text.Json.Serialization;
using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Entities;
using Hms.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Hms.Api.Controllers;

// PDF 3.9 Staff Management, following the role table row "Staff, attendance, leave":
// Administrator: full. Every other role: own leave only (the "my/leave" endpoints).
[ApiController]
[Route("api/staff")]
[Authorize]
public class StaffController(StaffService staff, AuditService audit, UserManager<AppUser> userManager) : ControllerBase
{
    private static readonly JsonSerializerOptions AuditJson = new() { Converters = { new JsonStringEnumConverter() } };

    // ---------- Employees (Admin) ----------

    // GET /api/staff/employees?search=nurse&departmentId=2&includeInactive=true
    [HttpGet("employees")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<List<EmployeeSummary>> Employees(string? search, int? departmentId, bool includeInactive = false) =>
        staff.ListEmployeesAsync(search, departmentId, includeInactive);

    // GET /api/staff/employees/5
    [HttpGet("employees/{id:int}")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<EmployeeDetail>> Employee(int id)
    {
        var employee = await staff.GetEmployeeAsync(id);
        return employee is null ? NotFound() : employee;
    }

    // POST /api/staff/employees   (FR-ST-01 register, FR-ST-03 department)
    [HttpPost("employees")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<EmployeeDetail>> CreateEmployee(EmployeeRequest request)
    {
        var result = await staff.CreateEmployeeAsync(request);
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var employee = (await staff.GetEmployeeAsync(result.Value))!;
        await Audit(AuditAction.Create, "Employee", employee.Id, request);
        return CreatedAtAction(nameof(Employee), new { id = employee.Id }, employee);
    }

    // PUT /api/staff/employees/5
    [HttpPut("employees/{id:int}")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<EmployeeDetail>> UpdateEmployee(int id, EmployeeRequest request)
    {
        var result = await staff.UpdateEmployeeAsync(id, request);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, "Employee", id, request);
        return (await staff.GetEmployeeAsync(id))!;
    }

    // PUT /api/staff/employees/5/login   { "userId": "..." } or { "userId": null } to unlink
    [HttpPut("employees/{id:int}/login")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<EmployeeDetail>> SetLogin(int id, EmployeeLoginRequest request)
    {
        var result = await staff.SetLoginAsync(id, request.UserId);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var employee = (await staff.GetEmployeeAsync(id))!;
        await Audit(AuditAction.Update, "Employee", id, new { LinkedUserId = employee.UserId, LinkedUserName = employee.UserName });
        return employee;
    }

    // GET /api/staff/unlinked-users   (login accounts not linked to an employee yet)
    [HttpGet("unlinked-users")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<List<UnlinkedUser>> UnlinkedUsers() => staff.ListUnlinkedUsersAsync();

    // ---------- Attendance (Admin, assumption A14: manual entry) ----------

    // GET /api/staff/attendance?date=2026-11-20
    [HttpGet("attendance")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<AttendanceSheet> Attendance(DateOnly? date) =>
        staff.GetAttendanceSheetAsync(date ?? HospitalTime.Today);

    // PUT /api/staff/attendance   { "date": "2026-11-20", "entries": [ { "employeeId": 3, "status": "Present", ... } ] }
    [HttpPut("attendance")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<AttendanceSheet>> SaveAttendance(AttendanceSaveRequest request)
    {
        var result = await staff.SaveAttendanceAsync(request, userManager.GetUserId(User));
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, "Attendance", request.Date!.Value.ToString("yyyy-MM-dd"), request.Entries);
        return await staff.GetAttendanceSheetAsync(request.Date!.Value);
    }

    // GET /api/staff/employees/5/attendance?fromDate=2026-11-01&toDate=2026-11-30
    [HttpGet("employees/{id:int}/attendance")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<EmployeeAttendance>> EmployeeAttendance(int id, DateOnly? fromDate, DateOnly? toDate)
    {
        var result = await staff.GetEmployeeAttendanceAsync(id, fromDate, toDate);
        if (result.IsNotFound) return NotFound();
        return result.Succeeded ? result.Value! : this.ValidationErrors(result.Errors);
    }

    // ---------- Leave (Admin) ----------

    // GET /api/staff/leave?status=Pending
    [HttpGet("leave")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<List<LeaveResponse>> Leave(LeaveStatus? status) => staff.ListLeaveAsync(status);

    // POST /api/staff/leave   (record leave for an employee, for example one without a login)
    [HttpPost("leave")]
    [Authorize(Policy = Policies.ManageStaff)]
    public async Task<ActionResult<LeaveResponse>> CreateLeave(LeaveCreateForEmployeeRequest request)
    {
        var result = await staff.RequestLeaveForAsync(request, userManager.GetUserId(User));
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        return await LeaveCreated(result.Value);
    }

    // POST /api/staff/leave/7/approve   { "note": "optional" }
    [HttpPost("leave/{id:int}/approve")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<ActionResult<LeaveResponse>> Approve(int id, LeaveReviewRequest request) => Review(id, true, request);

    // POST /api/staff/leave/7/reject   { "note": "required" }
    [HttpPost("leave/{id:int}/reject")]
    [Authorize(Policy = Policies.ManageStaff)]
    public Task<ActionResult<LeaveResponse>> Reject(int id, LeaveReviewRequest request) => Review(id, false, request);

    // ---------- Own leave (every signed-in user) ----------

    // GET /api/staff/my/leave
    [HttpGet("my/leave")]
    public Task<MyLeave> MyLeave() => staff.GetMyLeaveAsync(userManager.GetUserId(User)!);

    // POST /api/staff/my/leave
    [HttpPost("my/leave")]
    public async Task<ActionResult<LeaveResponse>> RequestLeave(LeaveCreateRequest request)
    {
        var result = await staff.RequestOwnLeaveAsync(userManager.GetUserId(User)!, request);
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);
        return await LeaveCreated(result.Value);
    }

    // POST /api/staff/my/leave/7/cancel   (withdraw a request that is still pending)
    [HttpPost("my/leave/{id:int}/cancel")]
    public async Task<ActionResult<LeaveResponse>> CancelLeave(int id)
    {
        var result = await staff.CancelOwnLeaveAsync(id, userManager.GetUserId(User)!);
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        await Audit(AuditAction.Update, "LeaveRequest", id, new { Status = LeaveStatus.Cancelled });
        return (await staff.GetLeaveAsync(id))!;
    }

    private async Task<ActionResult<LeaveResponse>> Review(int id, bool approve, LeaveReviewRequest request)
    {
        var result = await staff.ReviewLeaveAsync(id, approve, request.Note, userManager.GetUserId(User));
        if (result.IsNotFound) return NotFound();
        if (!result.Succeeded) return this.ValidationErrors(result.Errors);

        var leave = (await staff.GetLeaveAsync(id))!;
        await Audit(AuditAction.Update, "LeaveRequest", id, new { leave.Status, leave.ReviewNote });
        return leave;
    }

    private async Task<ActionResult<LeaveResponse>> LeaveCreated(int id)
    {
        var leave = (await staff.GetLeaveAsync(id))!;
        await Audit(AuditAction.Create, "LeaveRequest", id, new
        {
            leave.EmployeeId, leave.LeaveType, leave.StartDate, leave.EndDate, leave.Days,
        });
        return StatusCode(StatusCodes.Status201Created, leave);
    }

    private Task Audit(AuditAction action, string entity, object id, object changes) =>
        audit.LogAsync(action, userManager.GetUserId(User), User.Identity?.Name, entity, id.ToString(),
            JsonSerializer.Serialize(changes, AuditJson));
}
