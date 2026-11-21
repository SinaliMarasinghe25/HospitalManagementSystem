namespace Hms.Api.Services;

// Turns what the user typed into a safe "contains" pattern for EF.Functions.ILike(column, pattern, "\\").
// % and _ are wildcards in SQL LIKE, so they are escaped: searching "50%" finds "50%", not everything.
// (The value is still sent as a SQL parameter, so this is about correct results, not SQL injection.)
public static class SearchText
{
    public static string Contains(string search) => $"%{EscapeWildcards(search.Trim())}%";

    private static string EscapeWildcards(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
}
