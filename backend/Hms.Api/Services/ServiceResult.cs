namespace Hms.Api.Services;

// A small result type so services can say "ok", "not found" or "invalid"
// without knowing anything about HTTP. The controller turns it into 200/404/400.
public class ServiceResult<T>
{
    public T? Value { get; private init; }
    public bool IsNotFound { get; private init; }
    public Dictionary<string, string[]> Errors { get; private init; } = [];
    public bool Succeeded => !IsNotFound && Errors.Count == 0;

    public static ServiceResult<T> Ok(T value) => new() { Value = value };
    public static ServiceResult<T> NotFound() => new() { IsNotFound = true };
    public static ServiceResult<T> Invalid(Dictionary<string, string[]> errors) => new() { Errors = errors };
}
