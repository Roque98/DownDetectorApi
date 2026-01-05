-- Downdetector API - Esquema Simplificado

-- =============================================
-- TABLAS
-- =============================================

-- Tabla de servicios a monitorear
CREATE TABLE Downdetector_Services (
    ServiceID INT IDENTITY(1,1) PRIMARY KEY,
    ServiceName NVARCHAR(100) NOT NULL UNIQUE,
    Domain NVARCHAR(10) DEFAULT 'com',
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

-- Tabla de reportes
CREATE TABLE Downdetector_Reports (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    ServiceID INT NOT NULL,
    Date DATETIME2 NOT NULL,
    ReportValue INT NOT NULL,
    BaseLineValue INT NOT NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    Status NVARCHAR(20),
    StatusCode INT,
    FOREIGN KEY (ServiceID) REFERENCES Downdetector_Services(ServiceID) ON DELETE CASCADE,
    -- Índices para búsquedas rápidas
    INDEX IX_Reports_ServiceDate (ServiceID, Date DESC),
    INDEX IX_Reports_Date (Date DESC),
    INDEX IX_Reports_Status (StatusCode DESC),
    -- Restricción única para evitar duplicados por fecha y servicio
    UNIQUE (ServiceID, Date)
);
GO

-- =============================================
-- STORED PROCEDURES
-- =============================================

-- SP: Insertar o actualizar servicio
CREATE PROCEDURE Downdetector_UpsertService
    @ServiceName NVARCHAR(100),
    @Domain NVARCHAR(10) = 'com',
    @IsActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM Downdetector_Services WHERE ServiceName = @ServiceName)
    BEGIN
        UPDATE Downdetector_Services
        SET Domain = @Domain,
            IsActive = @IsActive,
            UpdatedAt = GETDATE()
        WHERE ServiceName = @ServiceName;
    END
    ELSE
    BEGIN
        INSERT INTO Downdetector_Services (ServiceName, Domain, IsActive)
        VALUES (@ServiceName, @Domain, @IsActive);
    END

    -- Retornar el servicio
    SELECT ServiceID, ServiceName, Domain, IsActive
    FROM Downdetector_Services
    WHERE ServiceName = @ServiceName;
END;
GO

-- SP: Insertar reporte con cálculo automático de Status
-- Si el registro ya existe (mismo ServiceID y Date), NO hacer nada
-- StatusCode: 0=Normal, 1=Atención, 2=Alerta, 3=Crítico, 4=Emergencia, -1=Sin Baseline
CREATE PROCEDURE Downdetector_UpsertReport
    @ServiceID INT,
    @Date DATETIME2,
    @ReportValue INT,
    @BaseLineValue INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Verificar si ya existe un reporte para este servicio y fecha
    IF EXISTS (
        SELECT 1
        FROM Downdetector_Reports
        WHERE ServiceID = @ServiceID AND Date = @Date
    )
    BEGIN
        -- El registro ya existe, NO hacer nada
        SELECT
            'EXISTS' as Action,
            @ServiceID as ServiceID,
            @Date as Date,
            'Record already exists, no action taken' as Message;
        RETURN;
    END

    -- El registro NO existe, proceder con el INSERT
    DECLARE @Status NVARCHAR(20);
    DECLARE @StatusCode INT;
    DECLARE @Multiplicador FLOAT;

    -- Calcular multiplicador y determinar Status según umbrales
    IF @BaseLineValue > 0
    BEGIN
        SET @Multiplicador = CAST(@ReportValue AS FLOAT) / @BaseLineValue;

        -- Umbrales:
        -- >= 20x = EMERGENCIA (4)
        -- >= 10x = CRITICO (3)
        -- >= 5x  = ALERTA (2)
        -- >= 2x  = ATENCION (1)
        -- < 2x   = NORMAL (0)
        IF @Multiplicador >= 20
        BEGIN
            SET @Status = 'EMERGENCIA';
            SET @StatusCode = 4;
        END
        ELSE IF @Multiplicador >= 10
        BEGIN
            SET @Status = 'CRITICO';
            SET @StatusCode = 3;
        END
        ELSE IF @Multiplicador >= 5
        BEGIN
            SET @Status = 'ALERTA';
            SET @StatusCode = 2;
        END
        ELSE IF @Multiplicador >= 2
        BEGIN
            SET @Status = 'ATENCION';
            SET @StatusCode = 1;
        END
        ELSE
        BEGIN
            SET @Status = 'NORMAL';
            SET @StatusCode = 0;
        END
    END
    ELSE
    BEGIN
        -- Si no hay baseline válido
        SET @Status = 'SIN_BASELINE';
        SET @StatusCode = -1;
        SET @Multiplicador = NULL;
    END

    -- INSERT: Insertar nuevo reporte
    INSERT INTO Downdetector_Reports (ServiceID, Date, ReportValue, BaseLineValue, Status, StatusCode)
    VALUES (@ServiceID, @Date, @ReportValue, @BaseLineValue, @Status, @StatusCode);

    -- Retornar información del registro insertado
    SELECT
        'INSERTED' as Action,
        @ServiceID as ServiceID,
        @Date as Date,
        @ReportValue as ReportValue,
        @BaseLineValue as BaseLineValue,
        @Status as Status,
        @StatusCode as StatusCode,
        @Multiplicador as Multiplicador;
END;
GO

PRINT '==============================================';
PRINT '✓ Schema created successfully';
PRINT '==============================================';
PRINT '';
PRINT 'TABLAS:';
PRINT '  - Downdetector_Services';
PRINT '  - Downdetector_Reports';
PRINT '';
PRINT 'STORED PROCEDURES:';
PRINT '  - Downdetector_UpsertService';
PRINT '  - Downdetector_UpsertReport';
PRINT '';
PRINT 'LÓGICA DEL SP:';
PRINT '  - Si el registro YA existe → NO hace nada (retorna EXISTS)';
PRINT '  - Si el registro NO existe → Calcula Status e inserta';
PRINT '';
PRINT 'STATUS CODES:';
PRINT '  -1 = SIN_BASELINE (no hay baseline válido)';
PRINT '   0 = NORMAL (< 2x)';
PRINT '   1 = ATENCION (2x - 5x)';
PRINT '   2 = ALERTA (5x - 10x)';
PRINT '   3 = CRITICO (10x - 20x)';
PRINT '   4 = EMERGENCIA (>= 20x)';
PRINT '';
PRINT 'EJEMPLO DE USO:';
PRINT '  EXEC Downdetector_UpsertService @ServiceName = ''telegram'', @Domain = ''com'';';
PRINT '  EXEC Downdetector_UpsertReport @ServiceID = 1, @Date = ''2026-01-02 15:30'', @ReportValue = 450, @BaseLineValue = 15;';
PRINT '==============================================';
