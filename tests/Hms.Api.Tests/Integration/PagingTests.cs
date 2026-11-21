using Hms.Api.Authorization;
using Hms.Api.Dtos;
using Hms.Api.Services;
using Hms.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Tests.Integration;

// NFR-PERF-03 "lists are paged".
// First the shared paging code from step 26 (Services/Paging.cs) on a real PostgreSQL table,
// then the patient search through the API.
[Collection(ApiCollection.Name)]
public class PagingTests(HmsApiFactory api)
{
    // 25 patients with the same, unique last name, so a filter finds exactly these.
    private async Task<string> Add25PatientsAsync()
    {
        var lastName = $"Paging{Guid.NewGuid():N}"[..14];
        for (var i = 0; i < 25; i++) await api.AddPatientAsync(lastName);
        return lastName;
    }

    private IQueryable<int> SortedIds(Hms.Api.Data.AppDbContext db, string lastName) =>
        db.Patients.Where(p => p.LastName == lastName).OrderBy(p => p.Id).Select(p => p.Id);

    [Fact]
    public async Task Pages_have_the_right_size_and_never_repeat_or_skip_a_row()
    {
        var lastName = await Add25PatientsAsync();
        await using var db = api.CreateDbContext();

        var pages = new List<PagedResult<int>>();
        for (var page = 1; page <= 3; page++)
        {
            pages.Add(await SortedIds(db, lastName).ToPagedResultAsync(page, 10));
        }

        Assert.All(pages, p => Assert.Equal(25, p.TotalCount));
        Assert.Equal([10, 10, 5], pages.Select(p => p.Items.Count));
        var all = pages.SelectMany(p => p.Items).ToList();
        Assert.Equal(await SortedIds(db, lastName).ToListAsync(), all);   // every row once, in order
    }

    [Fact]
    public async Task A_page_past_the_end_gives_the_last_page()
    {
        var lastName = await Add25PatientsAsync();
        await using var db = api.CreateDbContext();

        var result = await SortedIds(db, lastName).ToPagedResultAsync(page: 99, pageSize: 10);

        Assert.Equal(3, result.Page);
        Assert.Equal(5, result.Items.Count);
    }

    [Fact]
    public async Task Page_size_is_kept_between_1_and_100_and_page_starts_at_1()
    {
        var lastName = await Add25PatientsAsync();
        await using var db = api.CreateDbContext();

        var huge = await SortedIds(db, lastName).ToPagedResultAsync(page: 1, pageSize: 1_000_000);
        var zero = await SortedIds(db, lastName).ToPagedResultAsync(page: -3, pageSize: 0);

        Assert.Equal(Paging.MaxPageSize, huge.PageSize);
        Assert.Equal(25, huge.Items.Count);
        Assert.Equal(1, zero.Page);
        Assert.Equal(1, zero.PageSize);
        Assert.Single(zero.Items);
    }

    [Fact]
    public async Task An_empty_list_is_page_1_of_1_with_no_rows()
    {
        await using var db = api.CreateDbContext();

        var result = await SortedIds(db, "NoSuchNameAnywhere").ToPagedResultAsync(page: 2, pageSize: 20);

        Assert.Equal(1, result.Page);
        Assert.Equal(0, result.TotalCount);
        Assert.Empty(result.Items);
    }

    [Fact]
    public async Task Patient_search_through_the_api_is_paged()
    {
        var lastName = await Add25PatientsAsync();
        var client = await api.LoginAsAsync(Roles.Receptionist);

        var page1 = await (await client.GetAsync($"/api/patients?search={lastName}&page=1&pageSize=20"))
            .ReadAsAsync<PagedResult<PatientSummary>>();
        var page2 = await (await client.GetAsync($"/api/patients?search={lastName}&page=2&pageSize=20"))
            .ReadAsAsync<PagedResult<PatientSummary>>();

        Assert.Equal(25, page1.TotalCount);
        Assert.Equal(20, page1.Items.Count);
        Assert.Equal(5, page2.Items.Count);
        Assert.Empty(page1.Items.Select(p => p.Id).Intersect(page2.Items.Select(p => p.Id)));
    }
}
