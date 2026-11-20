using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBilling : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Charges_AppointmentId",
                table: "Charges");

            migrationBuilder.DropIndex(
                name: "IX_Charges_LabRequestId",
                table: "Charges");

            migrationBuilder.DropIndex(
                name: "IX_Charges_StockMovementId",
                table: "Charges");

            migrationBuilder.CreateSequence(
                name: "InvoiceNumbers");

            migrationBuilder.CreateSequence(
                name: "ReceiptNumbers");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PaidAt",
                table: "Payments",
                column: "PaidAt");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_AppointmentId",
                table: "Charges",
                column: "AppointmentId",
                unique: true,
                filter: "\"AppointmentId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_LabRequestId",
                table: "Charges",
                column: "LabRequestId",
                unique: true,
                filter: "\"LabRequestId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_StockMovementId",
                table: "Charges",
                column: "StockMovementId",
                unique: true,
                filter: "\"StockMovementId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_PaidAt",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Charges_AppointmentId",
                table: "Charges");

            migrationBuilder.DropIndex(
                name: "IX_Charges_LabRequestId",
                table: "Charges");

            migrationBuilder.DropIndex(
                name: "IX_Charges_StockMovementId",
                table: "Charges");

            migrationBuilder.DropSequence(
                name: "InvoiceNumbers");

            migrationBuilder.DropSequence(
                name: "ReceiptNumbers");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_AppointmentId",
                table: "Charges",
                column: "AppointmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_LabRequestId",
                table: "Charges",
                column: "LabRequestId");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_StockMovementId",
                table: "Charges",
                column: "StockMovementId");
        }
    }
}
