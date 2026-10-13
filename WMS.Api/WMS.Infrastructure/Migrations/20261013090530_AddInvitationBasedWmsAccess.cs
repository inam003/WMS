using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvitationBasedWmsAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AccessProvisionedAt",
                table: "WmsUserAssignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE \"WmsUserAssignments\" SET \"AccessProvisionedAt\" = \"CreatedAt\" WHERE \"Role\" = 'Admin' AND \"AccessProvisionedAt\" IS NULL");

            migrationBuilder.CreateTable(
                name: "WmsInvitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    Role = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    InviterSubject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AcceptedSubject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WmsInvitations", x => x.Id);
                    table.CheckConstraint("CK_WmsInvitations_Role", "\"Role\" IN ('WarehouseManager', 'WarehouseOperator', 'Viewer')");
                    table.CheckConstraint("CK_WmsInvitations_Status", "\"Status\" IN ('Pending', 'Accepted', 'Expired', 'Revoked')");
                });

            migrationBuilder.CreateIndex(
                name: "IX_WmsInvitations_OnePendingPerEmail",
                table: "WmsInvitations",
                column: "NormalizedEmail",
                unique: true,
                filter: "\"Status\" = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_WmsInvitations_TokenHash",
                table: "WmsInvitations",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WmsInvitations");

            migrationBuilder.DropColumn(
                name: "AccessProvisionedAt",
                table: "WmsUserAssignments");
        }
    }
}
