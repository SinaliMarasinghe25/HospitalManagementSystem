using Hms.Api.Services;

namespace Hms.Api.Tests.Unit;

// SearchText turns what the user typed into a safe "contains" pattern for ILIKE.
public class SearchTextTests
{
    [Theory]
    [InlineData("perera", "%perera%")]
    [InlineData("  perera  ", "%perera%")]       // spaces around the text are ignored
    [InlineData("50%", "%50\\%%")]              // % is a wildcard in SQL, so it is escaped
    [InlineData("P_001", "%P\\_001%")]          // so is _
    [InlineData("a\\b", "%a\\\\b%")]            // and the escape character itself
    public void Contains_escapes_sql_wildcards(string typed, string expected)
    {
        Assert.Equal(expected, SearchText.Contains(typed));
    }
}
