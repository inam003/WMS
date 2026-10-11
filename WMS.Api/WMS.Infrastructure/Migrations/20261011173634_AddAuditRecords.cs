using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditRecords : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActorSubject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ActionType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    CorrelationId = table.Column<Guid>(type: "uuid", nullable: true),
                    BeforeValues = table.Column<string>(type: "jsonb", nullable: true),
                    AfterValues = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditRecords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_ActionType_CreatedAt",
                table: "AuditRecords",
                columns: new[] { "ActionType", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_ActorSubject_CreatedAt",
                table: "AuditRecords",
                columns: new[] { "ActorSubject", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_CorrelationId",
                table: "AuditRecords",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_CreatedAt",
                table: "AuditRecords",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_EntityType_CreatedAt",
                table: "AuditRecords",
                columns: new[] { "EntityType", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditRecords_ReferenceId",
                table: "AuditRecords",
                column: "ReferenceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditRecords");
        }
    }
}
