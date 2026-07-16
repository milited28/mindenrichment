// ============================================================================
// DATABASE.JS — core data model for the marketplace
// EDUCATORS and the dashboard MOCK_* arrays are currently mock data.
// Filters/keyword lists below are used by both the manual filter UI and the
// ME AI chat request parser.
// ============================================================================

/* ---------------- DATA ---------------- */

const EDUCATORS = [
  {
    id:1, name:"Serena Tan", headline:"Ex-MOE Math teacher, 8 yrs experience", category:"academic",
    subjects:["Mathematics","A-Math"], levels:["Secondary 3","Secondary 4"], mode:"Online & Bukit Timah",
    rate:"$60-80/hr", rating:4.9, reviews:34, verified:"approved", color:"var(--blue)",
    gender:"female", ethnicity:"Chinese", qualLevel:"Degree", background:["Ex-MOE teacher","Full-time educator"],
    availability:[{day:"Tuesday",start:17,end:20},{day:"Thursday",start:17,end:20},{day:"Saturday",start:9,end:13}],
        bio:"Former MOE secondary school teacher with 8 years in the classroom before moving to full-time tuition. I focus on building strong fundamentals in Math and A-Math rather than just drilling past papers, so students walk into exams actually understanding the working, not just memorising steps.",
    experience:[
      {org:"Ministry of Education, Singapore", role:"Secondary Mathematics Teacher", dates:"2014 - 2020"},
      {org:"Full-time private tuition", role:"Math & A-Math tutor", dates:"2020 - present"}
    ],
    quals:[
      {title:"B.Sc (Hons) Mathematics", institution:"National University of Singapore", year:"2013", status:"approved"},
      {title:"Postgraduate Diploma in Education", institution:"National Institute of Education", year:"2014", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Ong", rating:5, text:"My son went from a C6 to an A2 in one year for A-Math. Ms Tan is patient and explains concepts very clearly."},
      {author:"Mr Farid", rating:5, text:"Very structured lessons, always on time, and gives useful practice questions targeted at weak areas."}
    ]
  },
  {
    id:2, name:"Rajesh Kumar", headline:"PhD candidate (NUS Physics), JC specialist", category:"academic",
    subjects:["Pure Physics","Pure Chemistry"], levels:["JC1","JC2"], mode:"Online, islandwide",
    rate:"$70-90/hr", rating:4.8, reviews:21, verified:"approved", color:"var(--blue)",
    gender:"male", ethnicity:"Indian", qualLevel:"Degree", background:["Part-time educator"],
    availability:[{day:"Monday",start:18,end:21},{day:"Wednesday",start:18,end:21},{day:"Sunday",start:14,end:18}],
        bio:"I'm currently completing my PhD in Physics at NUS, and I've been tutoring JC Physics and Chemistry for the past 5 years. I like connecting textbook concepts to real experiments and everyday phenomena, which tends to make abstract topics click faster.",
    experience:[
      {org:"NUS Department of Physics", role:"PhD Candidate & Teaching Assistant", dates:"2021 - present"},
      {org:"Private tuition", role:"JC Physics & Chemistry tutor", dates:"2019 - present"}
    ],
    quals:[
      {title:"B.Sc (Hons) Physics", institution:"National University of Singapore", year:"2019", status:"approved"},
      {title:"PhD Physics (in progress)", institution:"National University of Singapore", year:"Expected 2026", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Koh", rating:5, text:"Explains JC Physics in a way that actually makes sense. My daughter's confidence has improved a lot."},
      {author:"Mr Tan", rating:4, text:"Solid tutor, sometimes moves a bit fast but always happy to slow down when asked."}
    ]
  },
  {
    id:3, name:"Hui Ling Chua", headline:"Primary Chinese & English specialist, 12 yrs", category:"language",
    subjects:["Chinese","English"], levels:["Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"], mode:"In-person, Toa Payoh",
    rate:"$45-60/hr", rating:5.0, reviews:52, verified:"approved", color:"var(--green)",
    gender:"female", ethnicity:"Chinese", qualLevel:"Degree", background:["Full-time educator"],
    availability:[{day:"Monday",start:15,end:18},{day:"Wednesday",start:15,end:18},{day:"Friday",start:15,end:18}],
        bio:"12 years helping primary school students build a genuine love for reading and writing in both Chinese and English, not just exam drilling. Especially experienced with PSLE Chinese composition and oral preparation.",
    experience:[{org:"Private tuition centre, Toa Payoh", role:"Chinese & English tutor", dates:"2012 - present"}],
    quals:[
      {title:"Bachelor of Arts, Chinese Language", institution:"Nanyang Technological University", year:"2011", status:"approved"},
      {title:"PSLE Oral Examiner Certification", institution:"SEAB-affiliated training", year:"2016", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Lee", rating:5, text:"Very warm with young children. My son actually looks forward to his Chinese lessons now."},
      {author:"Mdm Wong", rating:5, text:"Excellent PSLE composition guidance, saw real improvement within a few months."}
    ]
  },
  {
    id:4, name:"Daniel Goh", headline:"ABRSM piano examiner-trained, Grade 8 to diploma", category:"music",
    subjects:["Piano","Music Theory"], levels:["All ages"], mode:"Islandwide, in-person",
    rate:"$80-100/hr", rating:4.9, reviews:41, verified:"approved", color:"var(--blue)",
    gender:"male", ethnicity:"Chinese", qualLevel:"Diploma", background:["Full-time educator"],
    availability:[{day:"Tuesday",start:16,end:20},{day:"Thursday",start:16,end:20},{day:"Saturday",start:10,end:14}],
        bio:"10 years teaching piano from beginner to ABRSM Grade 8 and beyond. I trained under an examiner-affiliated program, so lessons are structured around what actually gets marked, while still leaving room for students to play music they enjoy.",
    experience:[
      {org:"Private piano studio", role:"Piano & Music Theory Instructor", dates:"2015 - present"},
      {org:"Yamaha Music School", role:"Junior piano instructor", dates:"2013 - 2015"}
    ],
    quals:[
      {title:"ABRSM Diploma (DipABRSM), Piano Performance", institution:"Associated Board of the Royal Schools of Music", year:"2015", status:"approved"},
      {title:"ABRSM Grade 8 Music Theory (Distinction)", institution:"ABRSM", year:"2009", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Sim", rating:5, text:"My daughter passed her Grade 6 piano with distinction. Very structured and encouraging teacher."},
      {author:"Mr Chen", rating:5, text:"Great with beginners, makes practice fun instead of a chore."}
    ]
  },
  {
    id:5, name:"Aisyah Rahman", headline:"Suzuki-method violin teacher for young beginners", category:"music",
    subjects:["Violin"], levels:["Ages 4-12"], mode:"Islandwide, in-person",
    rate:"$65-75/hr", rating:4.7, reviews:15, verified:"under_review", color:"var(--blue)",
    gender:"female", ethnicity:"Malay", qualLevel:"Certification", background:["Part-time educator"],
    availability:[{day:"Wednesday",start:9,end:12},{day:"Saturday",start:9,end:13},{day:"Sunday",start:9,end:13}],
        bio:"Trained in the Suzuki method, which focuses on ear training and repetition from a very young age. I specialise in getting young children comfortable holding and enjoying the violin before pushing technical rigour.",
    experience:[{org:"Suzuki Music School Singapore", role:"Violin Instructor", dates:"2019 - present"}],
    quals:[
      {title:"Suzuki Method Teacher Training, Book 1-4", institution:"Suzuki Association", year:"2019", status:"under_review"},
      {title:"ABRSM Grade 8 Violin (Distinction)", institution:"ABRSM", year:"2016", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Yeo", rating:5, text:"So patient with my 5 year old, he actually asks to practice now."},
      {author:"Mr Krishnan", rating:4, text:"Good teacher, still building her track record but very dedicated."}
    ]
  },
  {
    id:6, name:"Marcus Lee", headline:"Coding & robotics for kids, Scratch to Python", category:"other",
    subjects:["Coding","Robotics"], levels:["Primary 3","Primary 4","Primary 5","Primary 6","Secondary 1"], mode:"Hybrid",
    rate:"$60-70/hr", rating:4.8, reviews:19, verified:"approved", color:"var(--green)",
    gender:"male", ethnicity:"Chinese", qualLevel:"Degree", background:["Full-time educator"],
    availability:[{day:"Monday",start:17,end:20},{day:"Wednesday",start:17,end:20},{day:"Saturday",start:10,end:13}],
        bio:"Ex-software engineer turned kids' coding instructor. I teach Scratch for younger beginners and move into Python and basic Arduino robotics for older students who want to build actual projects, not just follow a worksheet.",
    experience:[
      {org:"Tech startup (backend engineer)", role:"Software Engineer", dates:"2016 - 2021"},
      {org:"Private coding tuition", role:"Coding & Robotics Instructor", dates:"2021 - present"}
    ],
    quals:[{title:"B.Eng Computer Engineering", institution:"Nanyang Technological University", year:"2016", status:"approved"}],
    testimonials:[
      {author:"Mr Ibrahim", rating:5, text:"My son built his first actual robot car after 3 months. Great hands-on teaching style."},
      {author:"Mrs Tan", rating:5, text:"Explains programming logic in a way kids actually understand."}
    ]
  },
  {
    id:7, name:"Priya Nair", headline:"PSLE English & creative writing specialist", category:"academic",
    subjects:["English","Creative Writing"], levels:["Primary 5","Primary 6"], mode:"Online",
    rate:"$50-60/hr", rating:4.9, reviews:28, verified:"approved", color:"var(--blue)",
    gender:"female", ethnicity:"Indian", qualLevel:"Degree", background:["Full-time educator"],
    availability:[{day:"Tuesday",start:15,end:18},{day:"Thursday",start:15,end:18},{day:"Sunday",start:10,end:13}],
        bio:"9 years focused specifically on PSLE English, especially composition writing and situational writing. I work with students on building a personal bank of ideas and phrases they can adapt in the exam, rather than memorising whole model essays.",
    experience:[{org:"Private tuition", role:"English & Creative Writing tutor", dates:"2015 - present"}],
    quals:[{title:"Bachelor of Arts, English Literature", institution:"National University of Singapore", year:"2014", status:"approved"}],
    testimonials:[
      {author:"Mrs Goh", rating:5, text:"My daughter's composition score improved by 8 marks in one term. Highly recommend."},
      {author:"Mr Lim", rating:5, text:"Gives genuinely useful feedback, not just generic corrections."}
    ]
  },
  {
    id:8, name:"Kenji Wong", headline:"Competitive swim coach, kids to teens", category:"sports",
    subjects:["Swimming"], levels:["Ages 5-16"], mode:"In-person, pools islandwide",
    rate:"$50-65/hr", rating:4.9, reviews:23, verified:"approved", color:"var(--blue)",
    gender:"male", ethnicity:"Chinese", qualLevel:"Certification", background:["Full-time educator"],
    availability:[{day:"Monday",start:8,end:11},{day:"Saturday",start:9,end:13},{day:"Sunday",start:9,end:13}],
        bio:"Former competitive swimmer, now coaching kids from complete beginners up to those training for inter-school competitions. I focus heavily on stroke technique and water confidence before pushing speed or endurance.",
    experience:[
      {org:"National swim club", role:"Competitive swimmer", dates:"2010 - 2018"},
      {org:"Private swim coaching", role:"Swim Coach", dates:"2018 - present"}
    ],
    quals:[
      {title:"Singapore Swimming Coaches Association Certification", institution:"SSCA", year:"2018", status:"approved"},
      {title:"First Aid & CPR Certified", institution:"Singapore Red Cross", year:"2023", status:"approved"}
    ],
    testimonials:[
      {author:"Mrs Ahmad", rating:5, text:"My daughter went from scared of water to swimming competitively in a year."},
      {author:"Mr Sim", rating:5, text:"Very safety conscious and good with nervous beginners."}
    ]
  }
];

const CATEGORY_LABELS = {academic:"Academic", music:"Music", language:"Language", sports:"Sports", other:"Other skills"};

const LEVEL_KEYWORDS = ["primary 1","primary 2","primary 3","primary 4","primary 5","primary 6",
  "p1","p2","p3","p4","p5","p6","secondary 1","secondary 2","secondary 3","secondary 4","secondary 5",
  "sec 1","sec 2","sec 3","sec 4","sec 5","jc1","jc2","jc 1","jc 2","psle","o-level","o level","a-level","a level","ib","poly"];

const SUBJECT_KEYWORDS = ["a-math","e-math","add math","e math","add maths","math","science","physics","chemistry","biology",
  "combined science","pure science","pure physics","pure chemistry","pure biology","economics","econs","computing",
  "english","chinese","higher chinese","malay","higher malay","tamil","higher tamil","mtl","mother tongue",
  "gp","general paper","piano","violin","guitar","coding","robotics","swimming","creative writing","music theory",
  "ems","emss","all subj","all subjects"];

const ABILITY_KEYWORDS = ["weak in","struggling","beginner","average","strong in","advanced","confident","not confident",
  "behind in","ahead in","complete beginner","failing","fail","fails","not doing well","doing badly","below average",
  "top of class","excelling","aiming for","target grade","score of","need to pass","borderline","bottom of class"];

const STYLE_KEYWORDS = ["patient","hands-on","hands on","visual","structured","needs encouragement","independent","exploratory",
  "needs structure","gets bored easily","needs discipline","interactive","dyslexia","dyslexic","adhd","autism","autistic",
  "special needs","learning difficulty","learning difficulties","needs one-on-one","needs extra support","short attention span"];

const PREF_KEYWORDS = ["female","male","experienced","native speaker","ex-moe","online","in-person","in person",
  "chinese tutor","malay tutor","indian tutor","eurasian"];

const FOCUS_TRIGGERS = ["weak in","struggling with","struggling in","need help with","preparing for","want to improve",
  "building confidence in","aiming for","failing"];

const EXAMPLE_PROMPTS = [
  "My child's level & grade — e.g. Secondary 3",
  "Subject or skill — e.g. A-Math, Piano, Coding",
  "Current ability — e.g. weak in algebra, complete beginner",
  "Learning style — e.g. patient, hands-on, gets bored easily"
];

const DROPDOWNS = {
  level: {
    groups: [
      {label:"Primary", stateKey:"level", options:["Preschool","Primary 1","Primary 2","Primary 3","Primary 4","Primary 5","Primary 6"]},
      {label:"Secondary", stateKey:"level", options:["Secondary 1","Secondary 2","Secondary 3","Secondary 4","Secondary 5"]},
      {label:"Pre-University & beyond", stateKey:"level", options:["JC1","JC2","Poly","University"]}
    ]
  },
  subject: {
    groups: [
      {label:"Academic", stateKey:"subject", options:["English","Mathematics","Science","A-Math","E-Math",
        "Combined Science (Physics)","Combined Science (Chemistry)","Combined Science (Biology)",
        "Pure Physics","Pure Chemistry","Pure Biology","Economics","Computing","Creative Writing","General Paper"]},
      {label:"Humanities", stateKey:"subject", options:["Social Studies","Pure Geography","Pure History",
        "Combined Geography","Combined History","Principles of Accounts","Elements of Business Skills",
        "Literature","Theatre Studies and Drama","Music (Academic)"]},
      {label:"Mother Tongue", stateKey:"subject", options:["Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil"]},
      {label:"Music", stateKey:"subject", options:["Piano","Violin","Guitar","Music Theory"]},
      {label:"Other Skills", stateKey:"subject", options:["Coding","Robotics","Swimming"]}
    ]
  },
  schedule: { groups: [] }, // rendered as a custom day/time builder, see renderSchedulePickers()
  qualification: {
    groups: [
      {label:"Qualification level", stateKey:"quallevel", options:["Degree","Diploma","Certification"]},
      {label:"Teaching background", stateKey:"background", options:["Full-time educator","Part-time educator","Ex-MOE teacher","Current MOE teacher"]}
    ]
  },
  preferences: {
    groups: [
      {label:"Gender", stateKey:"gender", options:["Female","Male"]},
      {label:"Race", stateKey:"race", options:["Chinese","Malay","Indian","Eurasian","Other"]}
    ]
  }
};

// Which Academic/Mother Tongue subjects are actually offered at each level.
// Music and Other Skills are never restricted by level (enrichment, not curriculum-bound).

const LEVEL_SUBJECTS = {
  "Preschool": ["English","Mathematics"],
  "Primary 1": ["English","Mathematics","Chinese","Malay","Tamil"],
  "Primary 2": ["English","Mathematics","Chinese","Malay","Tamil"],
  "Primary 3": ["English","Mathematics","Science","Chinese","Malay","Tamil"],
  "Primary 4": ["English","Mathematics","Science","Chinese","Malay","Tamil"],
  "Primary 5": ["English","Mathematics","Science","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing"],
  "Primary 6": ["English","Mathematics","Science","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing"],
  "Secondary 1": ["English","Mathematics","Science","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing",
    "Social Studies","Literature"],
  "Secondary 2": ["English","Mathematics","Science","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing",
    "Social Studies","Literature"],
  "Secondary 3": ["English","A-Math","E-Math","Combined Science (Physics)","Combined Science (Chemistry)","Combined Science (Biology)",
    "Pure Physics","Pure Chemistry","Pure Biology","Economics","Computing","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing",
    "Social Studies","Pure Geography","Pure History","Combined Geography","Combined History","Principles of Accounts",
    "Elements of Business Skills","Literature","Theatre Studies and Drama","Music (Academic)"],
  "Secondary 4": ["English","A-Math","E-Math","Combined Science (Physics)","Combined Science (Chemistry)","Combined Science (Biology)",
    "Pure Physics","Pure Chemistry","Pure Biology","Economics","Computing","Chinese","Higher Chinese","Malay","Higher Malay","Tamil","Higher Tamil","Creative Writing",
    "Social Studies","Pure Geography","Pure History","Combined Geography","Combined History","Principles of Accounts",
    "Elements of Business Skills","Literature","Theatre Studies and Drama","Music (Academic)"],
  "Secondary 5": ["English","E-Math","Combined Science (Physics)","Combined Science (Chemistry)","Combined Science (Biology)","Chinese","Malay","Tamil",
    "Social Studies","Combined Geography","Combined History","Elements of Business Skills"],
  "JC1": ["General Paper","Mathematics","Pure Physics","Pure Chemistry","Pure Biology","Economics","Computing","Higher Chinese","Higher Malay","Higher Tamil",
    "Pure Geography","Pure History","Literature"],
  "JC2": ["General Paper","Mathematics","Pure Physics","Pure Chemistry","Pure Biology","Economics","Computing","Higher Chinese","Higher Malay","Higher Tamil",
    "Pure Geography","Pure History","Literature"],
  "Poly": ["English","Mathematics","Economics","Computing"],
  "University": ["English","Mathematics","Economics","Computing"]
};

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const HOUR_MARKS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

const GRID_HOURS = HOUR_MARKS.slice(0, -1); // 7am..9pm start-hours, for the weekly grid

const MOCK_MY_QUALS = [
  {title:"B.Sc (Hons) Mathematics", institution:"National University of Singapore", year:"2013", status:"approved"},
  {title:"Postgraduate Diploma in Education", institution:"National Institute of Education", year:"2014", status:"approved"},
  {title:"ABRSM Grade 8 Music Theory", institution:"ABRSM", year:"2022", status:"under_review"}
];

const MOCK_EDU_REQUESTS = [
  {text:"Sec 3 A-Math, weak in algebra, prefers a patient tutor", status:"new"},
  {text:"Sec 4 student aiming for A1, needs exam-focused revision", status:"responded"}
];

const MOCK_CHILDREN = [
  {name:"Ethan Lim", level:"Secondary 3", initials:"EL"},
  {name:"Chloe Lim", level:"Primary 5", initials:"CL"}
];

const MOCK_REQUESTS = [
  {text:"Sec 3 A-Math tutor, weak in algebra, prefers patient tutor", status:"matched"},
  {text:"Piano teacher for Chloe, complete beginner", status:"searching"}
];

