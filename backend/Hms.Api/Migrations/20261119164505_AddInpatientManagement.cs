using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Hms.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInpatientManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "AdmissionNumbers");

            migrationBuilder.CreateTable(
                name: "BedTransfers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AdmissionId = table.Column<int>(type: "integer", nullable: false),
                    FromBedId = table.Column<int>(type: "integer", nullable: false),
                    ToBedId = table.Column<int>(type: "integer", nullable: false),
                    TransferredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    TransferredByUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BedTransfers", x => x.Id);
                    table.CheckConstraint("CK_BedTransfers_DifferentBeds", "\"FromBedId\" <> \"ToBedId\"");
                    table.ForeignKey(
                        name: "FK_BedTransfers_Admissions_AdmissionId",
                        column: x => x.AdmissionId,
                        principalTable: "Admissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BedTransfers_Beds_FromBedId",
                        column: x => x.FromBedId,
                        principalTable: "Beds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BedTransfers_Beds_ToBedId",
                        column: x => x.ToBedId,
                        principalTable: "Beds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BedTransfers_Users_TransferredByUserId",
                        column: x => x.TransferredByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BedTransfers_AdmissionId",
                table: "BedTransfers",
                column: "AdmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_BedTransfers_FromBedId",
                table: "BedTransfers",
                column: "FromBedId");

            migrationBuilder.CreateIndex(
                name: "IX_BedTransfers_ToBedId",
                table: "BedTransfers",
                column: "ToBedId");

            migrationBuilder.CreateIndex(
                name: "IX_BedTransfers_TransferredByUserId",
                table: "BedTransfers",
                column: "TransferredByUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BedTransfers");

            migrationBuilder.DropSequence(
                name: "AdmissionNumbers");
        }
    }
}
