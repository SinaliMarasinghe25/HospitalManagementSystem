namespace Hms.Api.Data;

// The made-up people, places and clinical cases that DemoDataSeeder uses.
// Every name, NIC, phone number and licence number here is invented for the demo. None belongs to a real person.
public static class DemoDataCatalog
{
    // ---------- Staff ----------

    public record DoctorInfo(
        string FirstName, string LastName, string UserName, string Department, string Specialization,
        string License, decimal Fee, int SlotMinutes, string Phone,
        (DayOfWeek Day, int FromHour, int ToHour)[] Sessions, string CaseGroup);

    // The first licence number is also the "demo data already added" marker (see DemoDataSeeder.MarkerLicense).
    public static readonly DoctorInfo[] Doctors =
    [
        new("Nuwan", "Perera", "nuwan.perera", "General Medicine", "General Physician", "SLMC-21457", 2500m, 15, "077 214 5871",
            [(DayOfWeek.Monday, 8, 12), (DayOfWeek.Tuesday, 8, 12), (DayOfWeek.Wednesday, 14, 17), (DayOfWeek.Thursday, 8, 12), (DayOfWeek.Friday, 8, 12), (DayOfWeek.Saturday, 8, 11)],
            "general"),
        new("Dilani", "Fernando", "dilani.fernando", "Cardiology", "Consultant Cardiologist", "SLMC-18832", 3500m, 20, "071 883 2290",
            [(DayOfWeek.Monday, 14, 17), (DayOfWeek.Wednesday, 8, 12), (DayOfWeek.Friday, 14, 17)],
            "cardiology"),
        new("Kasun", "Jayawardena", "kasun.jayawardena", "Paediatrics", "Consultant Paediatrician", "SLMC-22610", 3000m, 15, "076 226 1045",
            [(DayOfWeek.Monday, 8, 12), (DayOfWeek.Tuesday, 14, 17), (DayOfWeek.Thursday, 8, 12), (DayOfWeek.Saturday, 8, 12)],
            "paediatrics"),
        new("Sanduni", "Wickramasinghe", "sanduni.wickramasinghe", "Obstetrics and Gynaecology", "Consultant Obstetrician and Gynaecologist", "SLMC-19974", 3500m, 20, "070 199 7438",
            [(DayOfWeek.Tuesday, 8, 12), (DayOfWeek.Thursday, 14, 17), (DayOfWeek.Saturday, 8, 11)],
            "obstetrics"),
    ];

    public record StaffInfo(string FirstName, string LastName, string? UserName, string Role, string JobTitle, string Department, string Phone);

    // Role is one of Authorization.Roles, or "" for staff without a login.
    public static readonly StaffInfo[] Staff =
    [
        new("Chathurika", "Rathnayake", "chathurika.rathnayake", "Nurse", "Nursing Sister", "Nursing", "077 310 4482"),
        new("Malsha", "Dissanayake", "malsha.dissanayake", "Nurse", "Staff Nurse", "Nursing", "071 452 9013"),
        new("Pradeep", "Kumara", "pradeep.kumara", "Nurse", "Staff Nurse", "Emergency", "076 118 3720"),
        new("Hiruni", "Senanayake", "hiruni.senanayake", "Nurse", "Staff Nurse", "Paediatrics", "070 926 3384"),
        new("Roshan", "Peiris", "roshan.peiris", "Nurse", "Staff Nurse", "Nursing", "077 908 1146"),
        new("Nadeesha", "Weerasinghe", "nadeesha.weerasinghe", "Receptionist", "Front Desk Officer", "Administration", "077 563 2148"),
        new("Kavindu", "Ekanayake", "kavindu.ekanayake", "Receptionist", "Front Desk Officer", "Administration", "072 804 6631"),
        new("Nilmini", "Fonseka", "nilmini.fonseka", "Receptionist", "Front Desk Officer", "Administration", "071 336 5809"),
        new("Lahiru", "Abeysekara", "lahiru.abeysekara", "LaboratoryStaff", "Medical Laboratory Technologist", "Laboratory", "075 337 9024"),
        new("Thilini", "Samarasinghe", "thilini.samarasinghe", "LaboratoryStaff", "Medical Laboratory Technologist", "Laboratory", "071 720 5546"),
        new("Ashan", "Wijesinghe", "ashan.wijesinghe", "Pharmacist", "Chief Pharmacist", "Pharmacy", "077 641 2093"),
        new("Dinusha", "Karunaratne", "dinusha.karunaratne", "Pharmacist", "Pharmacist", "Pharmacy", "076 590 3317"),
        new("Ramesh", "Liyanage", "ramesh.liyanage", "Accountant", "Accountant", "Administration", "070 482 7715"),
        new("Kumudu", "Jayasekara", "kumudu.jayasekara", "Accountant", "Billing Clerk", "Administration", "076 451 2230"),
        new("Sunil", "Gamage", null, "", "Hospital Attendant", "Administration", "078 215 6604"),
    ];

    public static readonly (string Name, string Description)[] ExtraDepartments =
    [
        ("Obstetrics and Gynaecology", "Pregnancy, childbirth and women's health"),
    ];

    // ---------- Patients ----------

    public static readonly string[] MaleNames =
    [
        "Kamal", "Sunil", "Nimal", "Saman", "Ajith", "Pradeep", "Chamara", "Dinesh", "Mahesh", "Lasantha",
        "Asela", "Sanjeewa", "Gayan", "Tharaka", "Buddhika", "Isuru", "Sachin", "Dulaj", "Yasiru", "Mohamed",
        "Rizwan", "Suresh", "Ravi", "Anura", "Upul",
    ];

    public static readonly string[] FemaleNames =
    [
        "Kumari", "Nirmala", "Shyamali", "Chandrika", "Dilrukshi", "Nadeeka", "Sewwandi", "Hasini", "Piumi", "Tharushi",
        "Ishani", "Amaya", "Sachini", "Fathima", "Priyanka", "Gayani", "Madhavi", "Anjali", "Rashmi", "Nethmi",
        "Kalpana", "Shalini", "Dulani", "Imesha", "Oshadi",
    ];

    public static readonly string[] BoyNames = ["Senuth", "Thenuka", "Dinuja", "Hasindu", "Sehan", "Vihanga", "Aadhil"];
    public static readonly string[] GirlNames = ["Senuli", "Thisuri", "Methuli", "Dewmini", "Nethuli", "Saneli", "Aysha"];

    public static readonly string[] Surnames =
    [
        "Perera", "Fernando", "De Silva", "Jayasuriya", "Ranasinghe", "Wijeratne", "Gunawardena", "Peiris", "Mendis", "Herath",
        "Rajapakse", "Dias", "Kumarasinghe", "Amarasinghe", "Wickramaratne", "Seneviratne", "Abeywickrama", "Pathirana",
        "Kariyawasam", "Hettiarachchi", "Jayasinghe", "Munasinghe", "Weerakoon", "Rodrigo", "Cooray", "Nawaz", "Sivakumar",
    ];

    public static readonly string[] Addresses =
    [
        "No. 24, Temple Road, Maharagama", "45/2, Galle Road, Dehiwala", "No. 12, Kandy Road, Kadawatha",
        "No. 78, High Level Road, Nugegoda", "No. 5, Lake Drive, Kurunegala", "No. 103, Main Street, Negombo",
        "No. 9, Station Road, Gampaha", "No. 31, Peradeniya Road, Kandy", "No. 66, Matara Road, Galle",
        "No. 18, Old Road, Panadura", "No. 220, Baseline Road, Colombo 09", "No. 4, Flower Road, Colombo 07",
        "No. 52, Horana Road, Piliyandala", "No. 14, Hospital Road, Kalutara", "No. 87, Colombo Road, Ratnapura",
        "No. 11, Church Street, Moratuwa", "No. 39, Hill Street, Kegalle", "No. 7, Beach Road, Matara",
        "No. 150, Avissawella Road, Homagama", "No. 23, Negombo Road, Ja-Ela",
    ];

    public static readonly string[] BloodGroups = ["O+", "O+", "O+", "A+", "A+", "B+", "B+", "AB+", "O-", "A-", "B-"];

    public static readonly string[] Allergies = ["Penicillin", "Sulphonamides", "Aspirin", "Seafood", "Peanuts", "Latex", "House dust mite"];

    // ---------- Clinical cases, per kind of clinic ----------

    // Medicine key = "Name|Strength|Form" of a Medicine row. PerDay null = one pack (inhaler, syrup, sachet box).
    public record MedicineLine(string Key, string Dosage, string Frequency, int PerDay, int Days, string? Instructions = null);

    public record Case(
        string Complaint, string Notes, string Code, string Diagnosis, string? Treatment,
        MedicineLine[] Medicines, string[] LabCodes);

    private const string Paracetamol = "Paracetamol|500 mg|Tablet";
    private const string Amoxicillin = "Amoxicillin|500 mg|Capsule";
    private const string Azithromycin = "Azithromycin|500 mg|Tablet";
    private const string Metformin = "Metformin|500 mg|Tablet";
    private const string Amlodipine = "Amlodipine|5 mg|Tablet";
    private const string Losartan = "Losartan|50 mg|Tablet";
    private const string Atorvastatin = "Atorvastatin|20 mg|Tablet";
    private const string Omeprazole = "Omeprazole|20 mg|Capsule";
    private const string Cetirizine = "Cetirizine|10 mg|Tablet";
    private const string Salbutamol = "Salbutamol|100 mcg|Inhaler";
    private const string Ors = "Oral Rehydration Salts|20.5 g|Sachet";
    private const string Ibuprofen = "Ibuprofen|400 mg|Tablet";
    private const string Clopidogrel = "Clopidogrel|75 mg|Tablet";
    private const string Diclofenac = "Diclofenac Sodium|50 mg|Tablet";
    private const string Chlorphenamine = "Chlorphenamine|4 mg|Tablet";
    private const string Domperidone = "Domperidone|10 mg|Tablet";
    private const string FolicAcid = "Folic Acid|1 mg|Tablet";
    private const string Ferrous = "Ferrous Sulphate|200 mg|Tablet";
    private const string ParacetamolSyrup = "Paracetamol Syrup|120 mg/5 ml|Bottle";
    private const string Prednisolone = "Prednisolone|5 mg|Tablet";

    // Medicines added on top of MedicineSeeder's starter list: (name, form, strength, price, reorder level).
    public static readonly (string Name, string Form, string Strength, decimal Price, int Reorder)[] ExtraMedicines =
    [
        ("Clopidogrel", "Tablet", "75 mg", 20.00m, 150),
        ("Diclofenac Sodium", "Tablet", "50 mg", 7.00m, 200),
        ("Chlorphenamine", "Tablet", "4 mg", 3.00m, 200),
        ("Domperidone", "Tablet", "10 mg", 6.00m, 150),
        ("Folic Acid", "Tablet", "1 mg", 2.50m, 300),
        ("Ferrous Sulphate", "Tablet", "200 mg", 3.50m, 300),
        ("Paracetamol Syrup", "Bottle", "120 mg/5 ml", 180.00m, 30),
        ("Prednisolone", "Tablet", "5 mg", 4.00m, 100),
    ];

    private static MedicineLine M(string key, string dosage, string frequency, int perDay, int days, string? instructions = null) =>
        new(key, dosage, frequency, perDay, days, instructions);

    public static readonly Dictionary<string, Case[]> Cases = new()
    {
        ["general"] =
        [
            new("Fever and body aches for 2 days", "Temp 38.6 C. No rash, no bleeding. Mild throat congestion. Advised fluids and rest. Dengue NS1 sent as fever < 3 days.",
                "A90", "Suspected dengue fever", "Advised oral fluids 2.5 L a day and review in 24 hours",
                [M(Paracetamol, "1 g", "Three times a day", 6, 3, "Do not take ibuprofen or aspirin"), M(Ors, "1 sachet", "Twice a day", 2, 3)],
                ["NS1", "FBC-PLT", "FBC-WBC"]),
            new("Cough and runny nose for 4 days", "Afebrile now. Chest clear. Throat mildly inflamed.",
                "J06.9", "Upper respiratory tract infection", null,
                [M(Paracetamol, "1 g", "Three times a day", 6, 3), M(Cetirizine, "10 mg", "At night", 1, 5)], []),
            new("Follow-up for diabetes", "On metformin. Home sugar readings 140 to 180. No hypoglycaemia. Feet examined, no ulcers.",
                "E11.9", "Type 2 diabetes mellitus", "Diet advice given",
                [M(Metformin, "500 mg", "Twice a day", 2, 30, "After meals")], ["FBS", "HBA1C"]),
            new("Headache and high BP at home", "BP 158/96. No chest pain. Fundus normal.",
                "I10", "Essential hypertension", "Low-salt diet advised",
                [M(Amlodipine, "5 mg", "Once a day", 1, 30)], ["SCR", "CHOL"]),
            new("Burning epigastric pain after meals", "Tender epigastrium, no guarding. No black stools.",
                "K29.7", "Gastritis", "Avoid spicy food and long gaps between meals",
                [M(Omeprazole, "20 mg", "Once a day", 1, 14, "Before breakfast"), M(Domperidone, "10 mg", "Three times a day", 3, 5)], []),
            new("Productive cough and fever for 5 days", "Crepitations right lower zone. SpO2 96%.",
                "J18.9", "Community-acquired pneumonia", null,
                [M(Amoxicillin, "500 mg", "Three times a day", 3, 7), M(Paracetamol, "1 g", "Three times a day", 6, 3)], ["FBC-WBC", "CRP"]),
            new("Burning when passing urine", "Suprapubic tenderness. Afebrile.",
                "N39.0", "Urinary tract infection", "Plenty of water advised",
                [M(Amoxicillin, "500 mg", "Three times a day", 3, 5)], ["UFR"]),
            new("Wheezing at night", "Known asthmatic. Bilateral rhonchi. Peak flow reduced.",
                "J45.9", "Bronchial asthma, mild exacerbation", "Inhaler technique explained",
                [M(Salbutamol, "2 puffs", "When needed", 1, 30), M(Prednisolone, "30 mg", "Once a day", 6, 5, "After breakfast")], []),
            new("Itchy rash after eating prawns", "Urticarial wheals over trunk. No lip swelling, no wheeze.",
                "L50.0", "Allergic urticaria", "Advised to avoid seafood",
                [M(Chlorphenamine, "4 mg", "Three times a day", 3, 5), M(Cetirizine, "10 mg", "At night", 1, 7)], []),
        ],
        ["cardiology"] =
        [
            new("Chest tightness on exertion", "ECG: non-specific ST changes. BP 142/90. Referred for exercise ECG.",
                "I20.9", "Stable angina", "Lifestyle advice, stop smoking",
                [M(Clopidogrel, "75 mg", "Once a day", 1, 30), M(Atorvastatin, "20 mg", "At night", 1, 30)], ["CHOL", "FBS"]),
            new("Review of high blood pressure", "BP 150/94 on amlodipine. Adding losartan.",
                "I10", "Essential hypertension", null,
                [M(Amlodipine, "5 mg", "Once a day", 1, 30), M(Losartan, "50 mg", "Once a day", 1, 30)], ["SCR"]),
            new("Palpitations for 1 week", "Pulse 96, regular. ECG sinus tachycardia. Thyroid tests advised.",
                "R00.2", "Palpitations", "Reduce tea and coffee",
                [], ["FBC-HB"]),
            new("High cholesterol on report", "Total cholesterol 260. No symptoms.",
                "E78.0", "Hypercholesterolaemia", "Diet and walking 30 minutes a day",
                [M(Atorvastatin, "20 mg", "At night", 1, 30)], ["CHOL"]),
        ],
        ["paediatrics"] =
        [
            new("Fever for 1 day", "Child active, feeding well. Throat red. No rash.",
                "J02.9", "Acute pharyngitis", null,
                [M(ParacetamolSyrup, "5 ml", "Every 6 hours when needed", 1, 3)], []),
            new("Loose stools and vomiting", "Mild dehydration. Abdomen soft.",
                "A09", "Acute gastroenteritis", "ORS after every loose stool",
                [M(Ors, "1 sachet", "After every loose stool", 3, 3), M(ParacetamolSyrup, "5 ml", "When needed", 1, 3)], ["UFR"]),
            new("Cough and wheeze", "Bilateral rhonchi. SpO2 97%.",
                "J21.9", "Acute bronchiolitis", "Nebulised salbutamol given in clinic",
                [M(Salbutamol, "2 puffs with spacer", "Three times a day", 1, 5)], []),
            new("Fever for 3 days with body aches", "Temp 39 C. Mild abdominal pain. Dengue suspected.",
                "A90", "Suspected dengue fever", "Fluid chart explained to mother",
                [M(ParacetamolSyrup, "7.5 ml", "Every 6 hours", 1, 3)], ["NS1", "FBC-PLT"]),
            new("Routine growth review", "Weight and height on the 50th centile. Vaccinations up to date.",
                "Z00.1", "Routine child health check", null, [], ["FBC-HB"]),
        ],
        ["obstetrics"] =
        [
            new("Antenatal clinic, 20 weeks", "Fundal height matches dates. Foetal heart heard. BP 110/70.",
                "Z34.0", "Normal pregnancy, supervision", "Anomaly scan booked",
                [M(FolicAcid, "1 mg", "Once a day", 1, 30), M(Ferrous, "200 mg", "Once a day", 1, 30, "After lunch")], ["FBC-HB", "UFR"]),
            new("Antenatal clinic, 28 weeks", "Mild ankle swelling. BP 124/80. Glucose challenge advised.",
                "Z34.8", "Normal pregnancy, supervision", null,
                [M(Ferrous, "200 mg", "Once a day", 1, 30)], ["FBS", "FBC-HB"]),
            new("Lower abdominal pain during periods", "Pelvic exam normal. Scan arranged.",
                "N94.6", "Dysmenorrhoea", null,
                [M(Ibuprofen, "400 mg", "Three times a day", 3, 3, "After meals")], []),
            new("Tiredness and heavy periods", "Pale conjunctivae.",
                "D50.9", "Iron deficiency anaemia", "Iron-rich diet advised",
                [M(Ferrous, "200 mg", "Twice a day", 2, 30)], ["FBC-HB"]),
        ],
        ["surgery"] =
        [
            new("Pain in the right lower abdomen", "Tender at McBurney's point. Low-grade fever. Surgical review advised.",
                "K35.8", "Acute appendicitis (suspected)", "Kept nil by mouth, scan requested",
                [M(Paracetamol, "1 g", "Three times a day", 6, 2)], ["FBC-WBC", "CRP"]),
            new("Lump in the groin", "Reducible right inguinal swelling, cough impulse present.",
                "K40.9", "Right inguinal hernia", "Listed for elective hernia repair", [], ["FBC-HB"]),
            new("Wound review after surgery", "Clean wound, sutures removed.",
                "Z48.0", "Post-operative wound care", "Sutures removed, dressing done", [], []),
            new("Upper abdominal pain after fatty meals", "Murphy's sign positive. Scan shows gallstones.",
                "K80.2", "Gallstones without cholecystitis", "Low-fat diet advised",
                [M(Paracetamol, "1 g", "Three times a day", 6, 3)], ["FBC-WBC"]),
        ],
        ["orthopaedics"] =
        [
            new("Knee pain for 3 months", "Crepitus both knees. No effusion. X-ray: joint space narrowing.",
                "M17.9", "Osteoarthritis of the knee", "Physiotherapy referral, weight loss advised",
                [M(Diclofenac, "50 mg", "Twice a day", 2, 10, "After meals"), M(Omeprazole, "20 mg", "Once a day", 1, 10)], []),
            new("Low back pain after lifting", "Paraspinal spasm. No leg weakness, straight-leg raise negative.",
                "M54.5", "Mechanical low back pain", "Back exercises taught",
                [M(Ibuprofen, "400 mg", "Three times a day", 3, 5, "After meals")], []),
            new("Fall on outstretched hand", "Swelling and tenderness at the wrist. X-ray: undisplaced distal radius fracture.",
                "S52.5", "Fracture of the distal radius", "Below-elbow plaster applied",
                [M(Paracetamol, "1 g", "Three times a day", 6, 5)], []),
            new("Shoulder pain and stiffness", "Painful arc. Reduced external rotation.",
                "M75.0", "Adhesive capsulitis of the shoulder", "Physiotherapy referral",
                [M(Diclofenac, "50 mg", "Twice a day", 2, 7, "After meals")], []),
        ],
    };

    // Ward reasons for admission: (reason, doctor case group, ICD code, diagnosis).
    public static readonly (string Reason, string Group, string Code, string Diagnosis)[] AdmissionReasons =
    [
        ("Dengue fever with low platelets, for monitoring", "general", "A91", "Dengue haemorrhagic fever"),
        ("Community-acquired pneumonia, needs IV antibiotics", "general", "J18.9", "Pneumonia"),
        ("Uncontrolled diabetes with high blood sugar", "general", "E11.65", "Type 2 diabetes with hyperglycaemia"),
        ("Chest pain, to rule out heart attack", "cardiology", "I20.0", "Unstable angina"),
        ("Acute appendicitis, for surgery", "surgery", "K35.8", "Acute appendicitis"),
        ("Gastroenteritis with dehydration", "paediatrics", "A09", "Acute gastroenteritis"),
        ("Fractured neck of femur after a fall", "orthopaedics", "S72.0", "Fracture of the neck of femur"),
        ("Admitted in labour", "obstetrics", "O80", "Normal delivery"),
        ("Acute asthma attack", "general", "J46", "Acute severe asthma"),
        ("Elective inguinal hernia repair", "surgery", "K40.9", "Inguinal hernia"),
    ];

    public static readonly (string Name, string Type, decimal Daily, string Prefix, int Beds)[] Wards =
    [
        ("Medical Ward (Male)", "General", 1500m, "MM-", 6),
        ("Medical Ward (Female)", "General", 1500m, "MF-", 6),
        ("Paediatric Ward", "Paediatric", 1500m, "PW-", 4),
        ("Maternity Ward", "Maternity", 2500m, "MT-", 4),
        ("Intensive Care Unit", "ICU", 12000m, "ICU-", 2),
    ];

    public static readonly string[] CancelReasons =
    [
        "Patient asked to cancel", "Patient is travelling", "Doctor on leave", "Booked by mistake", "Patient feeling better",
    ];
}
