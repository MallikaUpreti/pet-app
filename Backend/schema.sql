-- SQL Server schema for Pet App MVP

IF OBJECT_ID('dbo.Users','U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Role NVARCHAR(20) NOT NULL,
        FullName NVARCHAR(120) NOT NULL,
        Email NVARCHAR(160) NOT NULL,
        Phone NVARCHAR(40) NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_Users_Email UNIQUE (Email)
    );
END

IF OBJECT_ID('dbo.VetProfiles','U') IS NULL
BEGIN
    CREATE TABLE dbo.VetProfiles (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        ClinicName NVARCHAR(160) NULL,
        LicenseNo NVARCHAR(80) NULL,
        ClinicPhone NVARCHAR(40) NULL,
        Bio NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_VetProfiles_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
    );
END

IF OBJECT_ID('dbo.Pets','U') IS NULL
BEGIN
    CREATE TABLE dbo.Pets (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId INT NOT NULL,
        Name NVARCHAR(80) NOT NULL,
        Species NVARCHAR(40) NOT NULL,
        Breed NVARCHAR(80) NULL,
        AgeMonths INT NULL,
        WeightKg DECIMAL(6,2) NULL,
        Allergies NVARCHAR(500) NULL,
        Diseases NVARCHAR(500) NULL,
        PhotoUrl NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Pets_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id)
    );
END

IF OBJECT_ID('dbo.Appointments','U') IS NULL
BEGIN
    CREATE TABLE dbo.Appointments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId INT NOT NULL,
        VetUserId INT NOT NULL,
        PetId INT NOT NULL,
        Type NVARCHAR(60) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'Scheduled',
        StartTime DATETIME2 NOT NULL,
        EndTime DATETIME2 NULL,
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Appointments_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Appointments_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Appointments_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.DietPlans','U') IS NULL
BEGIN
    CREATE TABLE dbo.DietPlans (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        VetUserId INT NULL,
        Title NVARCHAR(120) NOT NULL,
        Details NVARCHAR(MAX) NOT NULL,
        Calories INT NULL,
        Allergies NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_DietPlans_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id),
        CONSTRAINT FK_DietPlans_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id)
    );
END

IF OBJECT_ID('dbo.Medications','U') IS NULL
BEGIN
    CREATE TABLE dbo.Medications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        Name NVARCHAR(120) NOT NULL,
        Dosage NVARCHAR(120) NULL,
        Frequency NVARCHAR(120) NULL,
        StartDate DATE NULL,
        EndDate DATE NULL,
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Medications_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.Vaccinations','U') IS NULL
BEGIN
    CREATE TABLE dbo.Vaccinations (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        Name NVARCHAR(120) NOT NULL,
        DueDate DATE NULL,
        Status NVARCHAR(40) NOT NULL DEFAULT 'Due',
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Vaccinations_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.Records','U') IS NULL
BEGIN
    CREATE TABLE dbo.Records (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        Title NVARCHAR(160) NOT NULL,
        FileUrl NVARCHAR(500) NULL,
        Notes NVARCHAR(1000) NULL,
        VisitDate DATE NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Records_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.AuthTokens','U') IS NULL
BEGIN
    CREATE TABLE dbo.AuthTokens (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        Token NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ExpiresAt DATETIME2 NOT NULL,
        CONSTRAINT FK_AuthTokens_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT UQ_AuthTokens_Token UNIQUE (Token)
    );
END
