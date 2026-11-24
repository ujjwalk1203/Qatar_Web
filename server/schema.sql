-- Apply once to a dedicated CRA DMS database using a deployment account.
CREATE TABLE dbo.DmsInventory (
  Id tinyint NOT NULL PRIMARY KEY CHECK (Id = 1),
  NetworkJson nvarchar(max) NOT NULL CHECK (ISJSON(NetworkJson) = 1)
);
CREATE SEQUENCE dbo.DmsRequestNumber AS bigint START WITH 1001 INCREMENT BY 1;
CREATE TABLE dbo.DmsReservation (
  Id varchar(64) NOT NULL PRIMARY KEY,
  Operator char(1) NOT NULL CHECK (Operator IN ('O','V','Q')),
  RequestKey uniqueidentifier NOT NULL,
  PayloadHash char(64) NOT NULL,
  RecordJson nvarchar(max) NOT NULL CHECK (ISJSON(RecordJson) = 1),
  UNIQUE (Operator, RequestKey)
);
CREATE TABLE dbo.DmsAudit (
  Id bigint IDENTITY PRIMARY KEY,
  AtUtc datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  Actor nvarchar(200) NOT NULL,
  Action nvarchar(80) NOT NULL,
  Target nvarchar(100) NOT NULL,
  Detail nvarchar(1000) NOT NULL
);
GO
CREATE TRIGGER dbo.DmsAuditImmutable ON dbo.DmsAudit INSTEAD OF UPDATE, DELETE
AS THROW 51001, 'Audit events are append-only.', 1;
GO
CREATE ROLE DmsApplication;
GRANT SELECT ON dbo.DmsInventory TO DmsApplication;
GRANT SELECT, INSERT, UPDATE ON dbo.DmsReservation TO DmsApplication;
GRANT UPDATE ON OBJECT::dbo.DmsRequestNumber TO DmsApplication;
GRANT SELECT, INSERT ON dbo.DmsAudit TO DmsApplication;

