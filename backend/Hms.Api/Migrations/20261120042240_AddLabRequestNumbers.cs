using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddLabRequestNumbers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "LabRequestNumbers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropSequence(
                name: "LabRequestNumbers");
        }
    }
}
