using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientNumberSequence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "PatientNumbers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropSequence(
                name: "PatientNumbers");
        }
    }
}
