using Hms.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Services;

// Paging (NFR-PERF-03 "lists are paged"): the API sends one page of a long list at a time,
// plus the total, so the page can show "page 2 of 7" with Previous and Next.
public static class Paging
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    // Runs two SQL queries: one COUNT for the total, and one with OFFSET/LIMIT for the rows.
    // The query must already be sorted, ending with a unique column (such as Id),
    // so a row never jumps between pages or shows up twice.
    // A page past the end gives the last page: after a row is removed (dispensed, approved, ...)
    // the list then still shows rows instead of an empty "page 3 of 2".
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, int page, int pageSize)
    {
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var total = await query.CountAsync();
        var lastPage = Math.Max(1, (total + pageSize - 1) / pageSize);
        page = Math.Clamp(page, 1, lastPage);

        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new PagedResult<T>(items, page, pageSize, total);
    }

    // Changes each row of a page, for lists whose rows are finished in C# after loading.
    public static PagedResult<TOut> Map<TIn, TOut>(this PagedResult<TIn> result, Func<TIn, TOut> map) =>
        new(result.Items.Select(map).ToList(), result.Page, result.PageSize, result.TotalCount);
}
