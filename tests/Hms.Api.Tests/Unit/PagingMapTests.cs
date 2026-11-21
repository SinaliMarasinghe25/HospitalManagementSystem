using Hms.Api.Dtos;
using Hms.Api.Services;

namespace Hms.Api.Tests.Unit;

public class PagingMapTests
{
    [Fact]
    public void Map_changes_the_rows_but_keeps_page_numbers_and_total()
    {
        var page = new PagedResult<int>([1, 2, 3], Page: 2, PageSize: 3, TotalCount: 8);

        var mapped = page.Map(n => $"row {n}");

        Assert.Equal(["row 1", "row 2", "row 3"], mapped.Items);
        Assert.Equal(2, mapped.Page);
        Assert.Equal(3, mapped.PageSize);
        Assert.Equal(8, mapped.TotalCount);
    }

    [Fact]
    public void The_server_limits_the_page_size()
    {
        Assert.Equal(20, Paging.DefaultPageSize);
        Assert.Equal(100, Paging.MaxPageSize);
    }
}
