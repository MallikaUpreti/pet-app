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
        IsOnline BIT NOT NULL DEFAULT 0,
        StartHour INT NULL,
        EndHour INT NULL,
        AvailableDays NVARCHAR(80) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_VetProfiles_User FOREIGN KEY (UserId) REFERENCES dbo.Users(Id)
    );
END

IF COL_LENGTH('dbo.VetProfiles', 'StartHour') IS NULL
BEGIN
    ALTER TABLE dbo.VetProfiles ADD StartHour INT NULL;
END

IF COL_LENGTH('dbo.VetProfiles', 'EndHour') IS NULL
BEGIN
    ALTER TABLE dbo.VetProfiles ADD EndHour INT NULL;
END

IF COL_LENGTH('dbo.VetProfiles', 'AvailableDays') IS NULL
BEGIN
    ALTER TABLE dbo.VetProfiles ADD AvailableDays NVARCHAR(80) NULL;
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
        FoodRestrictions NVARCHAR(500) NULL,
        HealthConditions NVARCHAR(500) NULL,
        ActivityLevel NVARCHAR(80) NULL,
        VaccinationHistory NVARCHAR(MAX) NULL,
        PhotoUrl NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Pets_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id)
    );
END

IF COL_LENGTH('dbo.Pets', 'FoodRestrictions') IS NULL
BEGIN
    ALTER TABLE dbo.Pets ADD FoodRestrictions NVARCHAR(500) NULL;
END

IF COL_LENGTH('dbo.Pets', 'HealthConditions') IS NULL
BEGIN
    ALTER TABLE dbo.Pets ADD HealthConditions NVARCHAR(500) NULL;
END

IF COL_LENGTH('dbo.Pets', 'ActivityLevel') IS NULL
BEGIN
    ALTER TABLE dbo.Pets ADD ActivityLevel NVARCHAR(80) NULL;
END

IF COL_LENGTH('dbo.Pets', 'VaccinationHistory') IS NULL
BEGIN
    ALTER TABLE dbo.Pets ADD VaccinationHistory NVARCHAR(MAX) NULL;
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
        AdministeredDate DATE NULL,
        Status NVARCHAR(40) NOT NULL DEFAULT 'Due',
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Vaccinations_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF COL_LENGTH('dbo.Vaccinations', 'AdministeredDate') IS NULL
BEGIN
    ALTER TABLE dbo.Vaccinations ADD AdministeredDate DATE NULL;
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

IF OBJECT_ID('dbo.AppointmentReports','U') IS NULL
BEGIN
    CREATE TABLE dbo.AppointmentReports (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AppointmentId INT NOT NULL,
        VetUserId INT NOT NULL,
        Diagnosis NVARCHAR(MAX) NOT NULL,
        MedicationsAndDoses NVARCHAR(MAX) NULL,
        DietRecommendation NVARCHAR(MAX) NULL,
        GeneralRecommendation NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_AppointmentReports_Appointment FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id),
        CONSTRAINT FK_AppointmentReports_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT UQ_AppointmentReports_Appointment UNIQUE (AppointmentId)
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

IF OBJECT_ID('dbo.ChatRequests','U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatRequests (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId INT NOT NULL,
        VetUserId INT NOT NULL,
        PetId INT NULL,
        Message NVARCHAR(1000) NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'Pending',
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_ChatRequests_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_ChatRequests_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_ChatRequests_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.Chats','U') IS NULL
BEGIN
    CREATE TABLE dbo.Chats (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId INT NOT NULL,
        VetUserId INT NOT NULL,
        PetId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Chats_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Chats_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_Chats_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.Messages','U') IS NULL
BEGIN
    CREATE TABLE dbo.Messages (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        ChatId INT NOT NULL,
        SenderRole NVARCHAR(20) NOT NULL,
        SenderId INT NOT NULL,
        Body NVARCHAR(MAX) NOT NULL,
        AttachmentUrl NVARCHAR(500) NULL,
        AttachmentType NVARCHAR(80) NULL,
        AttachmentName NVARCHAR(255) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Messages_Chat FOREIGN KEY (ChatId) REFERENCES dbo.Chats(Id)
    );
END

IF COL_LENGTH('dbo.Messages', 'AttachmentUrl') IS NULL
BEGIN
    ALTER TABLE dbo.Messages ADD AttachmentUrl NVARCHAR(500) NULL;
END

IF COL_LENGTH('dbo.Messages', 'AttachmentType') IS NULL
BEGIN
    ALTER TABLE dbo.Messages ADD AttachmentType NVARCHAR(80) NULL;
END

IF COL_LENGTH('dbo.Messages', 'AttachmentName') IS NULL
BEGIN
    ALTER TABLE dbo.Messages ADD AttachmentName NVARCHAR(255) NULL;
END

IF OBJECT_ID('dbo.HealthLogs','U') IS NULL
BEGIN
    CREATE TABLE dbo.HealthLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        OwnerId INT NOT NULL,
        Mood NVARCHAR(80) NULL,
        Appetite NVARCHAR(80) NULL,
        Notes NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_HealthLogs_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id),
        CONSTRAINT FK_HealthLogs_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id)
    );
END

IF OBJECT_ID('dbo.Meals','U') IS NULL
BEGIN
    CREATE TABLE dbo.Meals (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        PetId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        MealTime NVARCHAR(40) NULL,
        Calories INT NULL,
        Portion NVARCHAR(80) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Meals_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id)
    );
END

IF OBJECT_ID('dbo.MealLogs','U') IS NULL
BEGIN
    CREATE TABLE dbo.MealLogs (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MealId INT NOT NULL,
        FedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_MealLogs_Meal FOREIGN KEY (MealId) REFERENCES dbo.Meals(Id)
    );
END

IF OBJECT_ID('dbo.OwnerSettings','U') IS NULL
BEGIN
    CREATE TABLE dbo.OwnerSettings (
        OwnerId INT PRIMARY KEY,
        NotificationsEnabled BIT NOT NULL DEFAULT 1,
        DietRemindersEnabled BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_OwnerSettings_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id)
    );
END

IF OBJECT_ID('dbo.OwnerNotifications','U') IS NULL
BEGIN
    CREATE TABLE dbo.OwnerNotifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        OwnerId INT NOT NULL,
        AppointmentId INT NULL,
        Type NVARCHAR(40) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_OwnerNotifications_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_OwnerNotifications_Appointment FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id)
    );
END

IF OBJECT_ID('dbo.VetNotifications','U') IS NULL
BEGIN
    CREATE TABLE dbo.VetNotifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VetUserId INT NOT NULL,
        OwnerId INT NULL,
        PetId INT NULL,
        AppointmentId INT NULL,
        Type NVARCHAR(40) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_VetNotifications_Vet FOREIGN KEY (VetUserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_VetNotifications_Owner FOREIGN KEY (OwnerId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_VetNotifications_Pet FOREIGN KEY (PetId) REFERENCES dbo.Pets(Id),
        CONSTRAINT FK_VetNotifications_Appointment FOREIGN KEY (AppointmentId) REFERENCES dbo.Appointments(Id)
    );
END
