# Quantity Surveying course page content

- **Page:** `/course/102-quantity-surveying` (course.link unique id 102)
- **Audience:** enrolled students. They have been given access; most will see this page before and during the course.
- **Rules:**
  - plain British English, no em-dashes, nothing invented
  - learner reviews: only written reviews whose text does not mention Entri, quoted word for word, typos included (never edit a quote)
  - placement stories: name and role as shown on the Entri page; company only where its logo clearly reads as a name; names as text, no logos
  - the only placement figure is CBG's own "500+ placements across Saudi Arabia, the UAE, India, the Maldives and Africa"
  - section ids are stable

**Sources (in priority order):**
- Maasoom's Drive: `CBG_QS_LMS_Landing_Page_Copy` (the main source for wording) and `CBG_QS_Syllabus_8-Modules` (modules, sessions, assignments, certificate rules; the syllabus was rebuilt into 8 modules on 3 Oct 2026). These override Entri wherever they differ.
- The live course page `/course/102-quantity-surveying` (same copy as the Drive doc).
- The Entri course page (entri.app/course/quantity-surveying-course), ONLY for learner reviews, placement stories and faculty photos. CBG is the backend behind this Entri course.

The course.link header (title, subtitle, stats, "Contact To Enroll" button) and the Course Content accordion stay native. Restyle them; don't rebuild them.

**Left out on purpose:** the Drive doc's "Who it is for", "Eligibility" (FAQ 1 still covers both) and "What You Will Learn" (the units section shows each module's aims and sessions); Start Here and Course Completion as units; CV Session 2 as a numbered session (a tutoring session under M08_01); Entri's ratings, placement counts, video testimonials, logos, and every review that mentions Entri; certificate sample pictures (Entri-branded); Navanya Ramesh P's review (it mentions Entri; she stays in placements); faculty employers (left out in the Drive copy too); Elavenil E's photo (Entri shows a generic avatar for her). No bonus, field guides or payments sections (IOSH only).

---

## [card] Home page card
- **Title:** Quantity Surveying · **Status:** live now
- **Tag:** Live online · 8 months · Middle East projects
- **Line:** Online quantity surveying training covering BOQ preparation, billing, tendering, FIDIC contracts and project scheduling, with live Middle East construction projects.
- **Chips:** 8 months · Malayalam · Telugu · Tamil · Online (from Maasoom's workbook "CBG - Course List for Web Development.xlsx")
- **Button:** Open course, to `/course/102-quantity-surveying`

## [hero] Course at a glance
- **Eyebrow:** CBG Training Institute · Live online
- **Line (h2):** Quantity Surveying
- **Subhead:** An 8-month live online course for civil engineers. Learn to measure, price and manage construction costs on real Middle East projects, with CV support and placement assistance.
- **Key facts (counters):** 8 months · 8 modules · 55 technical hours · 11 assignments · 3 certificates
- **CTA for students:** "Start here". It scrolls to `#course_content` and opens its first accordion item (Start Here).
- **Visual:** build scrub. Full-width footage played by the scroll: a gold line drawing of a building plan that rises into a finished, lit building at dusk (frames in `public/qs-hero/`, 48 frames; poster `qs-hero-poster`).
- **Example take-off (beside the footage, labelled as an example).** ILLUSTRATIVE numbers for a small two-storey villa, for Maasoom to approve:

  | Item | Quantity | Counts up at |
  | :-- | --: | --: |
  | Excavation | 180 m³ | 0.2 |
  | Concrete | 95 m³ | 0.38 |
  | Reinforcement | 9,500 kg | 0.55 |
  | Blockwork | 620 m² | 0.72 |
  | Plaster | 1,300 m² | 0.9 |
  | **Closing row** | Ready to price in the BOQ | |

## [included] What is included
- **Heading:** One course, live projects and career support
- **Intro:** Everything below is part of your course, from your first class to your job search.
- **Cards** (the first is featured: the live projects are what set this course apart, and they lead to two of the three certificates, which have their own section):
  1. **Live projects from the Middle East.** Real project work from CBG's engineering services division, including a full civil and fit-out BOQ.
  2. **11 practical assignments.** From AutoCAD takeoffs to BOQs, BBS, rate analysis, estimates, RA bills, variations, cash flow and scheduling, each reviewed by CBG faculty, plus two CV submissions.
  3. **Software skills.** Excel, AutoCAD, PlanSwift and Primavera P6.
  4. **Industry interaction.** A session with experienced quantity surveyors on how the industry works day to day.
  5. **Personal mentorship.** A mentor to guide you and take up anything you need with CBG.
  6. **CV and interview preparation.** Two CV sessions, line-by-line CV reviews until your CV is final, CBG's AI CV builder (cvbuilder.carbonblueglobal.com), HR interview preparation and mock interviews.
  7. **Placement assistance.** Relevant job openings and interview support for eligible learners. CBG has supported 500+ placements across Saudi Arabia, the UAE, India, the Maldives and Africa.

## [units] The eight modules
- **Heading:** Your learning path: 8 modules, 39 sessions
- **Intro:** After the Start Here orientation, the 8 modules run in the order you meet the work on a real project, starting with the basics and building step by step, with assignments along the way.
- **Hours wording:** each module shows its number of sessions (from the syllabus roadmap table), not guided learning hours.
- **Module 1, M01: QS Foundations** (5 sessions)
  - Understand the QS role, the main construction components and the project workflow
  - Use Excel and AutoCAD for QS tasks
  - **Sessions:** 1.1 Introduction to QS · 1.2 Basics of Civil Engineering · 1.3 Construction Workflow · 1.4 Excel for QS · 1.5 AutoCAD for QS
- **Module 2, M02: Measurement and BOQ** (11 sessions)
  - Measure works to POMI
  - Take off quantities manually and in PlanSwift
  - Prepare complete BOQs and bar bending schedules
  - **Sessions:** 2.1 POMI Part 1 · 2.2 POMI Part 2 · 2.3 BOQ Preparation Part 1 · 2.4 BOQ Preparation Part 2 · 2.5 BOQ Preparation Part 3: Specifications · 2.6 BOQ Preparation Part 4 · 2.7 PlanSwift Part 1 · 2.8 PlanSwift Part 2 · 2.9 Interior Fit-Out BOQ · 2.10 Roadworks BOQ · 2.11 Bar Bending Schedule (BBS)
- **Module 3, M03: Estimating and Cost Planning** (3 sessions)
  - Build unit rates from first principles
  - Prepare estimates and detailed budgets
  - Apply value engineering
  - **Sessions:** 3.1 Rate Analysis · 3.2 Estimates · 3.3 Value Engineering
- **Module 4, M04: Tendering and Contracts** (4 sessions)
  - Explain the tender process
  - Compare contract types and FIDIC forms
  - Use contract conditions, work orders and purchase orders
  - **Sessions:** 4.1 Tendering · 4.2 Contracts and FIDIC · 4.3 GCC and SCC · 4.4 Work Orders and Purchase Orders
- **Module 5, M05: Post-Contract Billing** (4 sessions)
  - Prepare RA bills, final bills and certificates of payment
  - Value and log variations
  - Adjust provisional sums and prime cost items
  - **Sessions:** 5.1 RA Bill Preparation · 5.2 Final Bill and COP · 5.3 Variations and Extra Items · 5.4 Provisional Sums and Prime Cost
- **Module 6, M06: Cost Control and Planning** (7 sessions)
  - Forecast cash flow and prepare cost reports
  - Schedule projects in Primavera P6
  - Manage manpower, materials and machinery
  - **Sessions:** 6.1 Cash Flow · 6.2 Cost Reports · 6.3 Project Scheduling · 6.4 Primavera P6 Part 1 · 6.5 Primavera P6 Part 2 · 6.6 Primavera P6 Part 3 · 6.7 3M Management
- **Module 7, M07: Closeout and Live Project** (3 sessions)
  - Close out and hand over a project
  - Apply the full QS workflow to a real Middle East live project
  - **Sessions:** 7.1 Project Closeout and Handover · 7.2 Middle East Live Project · 7.3 Industry Interaction
- **Module 8, M08: Career Launch** (2 sessions)
  - Prepare a high-impact QS CV and LinkedIn profile
  - Get ready for HR and technical interviews
  - Use CBG's placement assistance
  - **Sessions:** 8.1 CV Session 1: CV and LinkedIn · 8.2 Interviews and Placement

## [xray] Rebar X-ray (bar bending schedule, Module 2 session 2.11)
- **Heading:** See the steel. Measure every bar.
- **Intro:** Concrete hides its reinforcement, but a quantity surveyor still has to count and measure every bar in it. In Module 2 you learn to read the structural drawing and prepare a bar bending schedule (BBS), from bar shapes and lap and development length to bend deduction and cutting length.
- **Pictures:** `qs-xray-concrete` (the concrete) and `qs-xray-steel` (the same shot with its steel showing). Alt: A reinforced concrete column and footing; where the scan passes, the steel bars inside the concrete show through.
- **Labels** (terms from the BBS session; points are first guesses in a 1536 x 1024 source, to be corrected once the pictures exist): Main bars · Stirrups · Lap length · Development length · Cutting length
- **Caption:** Assignment A04: a BBS for a footing and a column from a structural drawing.

## [how-classes-run] How your classes run
- **8 months, live online.** 55 hours of technical sessions plus 3 hours of HR and CV sessions, taught live by CBG faculty so you can ask questions as you go.
- **Classes on alternate days.** Your batch timetable is shared when you join.
- **Recorded sessions.** Revisit topics at your own pace. Live attendance still matters, as you need at least 75% to qualify for your certificates.
- **Help between classes.** A WhatsApp doubt-clearance line for each topic, and one-to-one sessions with faculty on request. Your mentor can take any unresolved issue to CBG for you.
- **What you need.** A laptop or PC with a stable internet connection. You will use Excel, AutoCAD, PlanSwift and Primavera P6, so make sure you can run them before the topics that use them.
- **Batch days:** Monday, Wednesday and Friday, or Tuesday, Thursday and Saturday.

## [assessment] How your work is assessed
- **Intro:** You learn by doing. Each assignment and CV submission has its own deadline, and CBG faculty review your work and return feedback within 15 working days.
- **A01 to A11: 11 practical assignments**
  - From AutoCAD takeoffs to BOQs, BBS, rate analysis, estimates, RA bills, variations, cash flow and scheduling
  - Due 3 to 21 days after the class, in the format the brief asks for
  - XLSX for BOQs and billing, DWG plus PDF for AutoCAD, XER plus PDF for Primavera
  - Score 70% or above for quality on every assignment to earn your certificates
- **CV1 and CV2: 2 CV submissions**
  - CV1 within 7 days of CV Session 1, CV2 within 7 days of CV Session 2 (PDF or DOCX)
  - CBG reviews your CV line by line
  - The review and revision loop continues until your CV is final
- **For reference (syllabus assignment summary, not shown as a table):** A01 AutoCAD Area and Perimeter (3 days, DWG + PDF) · A02 POMI Synopsis (3 days, PDF) · A03 Complete BOQ, Civil and Fit-Out (15 days, XLSX + PDF) · A04 BBS for Footing and Column (7 days, XLSX) · A05 Rate Analysis (5 days, XLSX) · A06 Detailed Budget Estimate (10 days, XLSX) · A07 RA Bill and COP (7 days, XLSX) · A08 Variations (7 days, XLSX + PDF) · A09 Cash Flow (10 days, XLSX) · A10 Planning and Scheduling (15 days, XER + PDF) · A11 Live Project BOQ (21 days, XLSX + PDF)

## [certificates] Your certificates
- **4 Oct 2026 (Maasoom):** the page names the certificates but says nothing about how they are earned (to be added later), so the 75%, 70% and 80% rules below and in the FAQ and class notes were taken off the page. Our own drawn certificate cards, no sample images.
- **Heading:** Three CBG certificates: one for the course, two for live projects
- **Intro:** Earn a Course Completion Certificate and two Live Project Certificates.
- **No sample pictures:** the only samples (on the Entri page) carry Entri branding (logo, seal, "on entri app"), so none are shown.
- **Course Completion Certificate.** Awarded when you complete the course and meet the rules below.
- **Two Live Project Certificates.** Earned on your Middle East live project, where you prepare civil and fit-out BOQs from live project drawings, guided by CBG faculty.
- **To qualify you need:**
  - at least 75% attendance in live classes
  - all assignments completed, scoring 70% or above for quality
  - at least 80% of the course content completed

## [trainers] Your faculty
- **Heading:** Your faculty: people who do the job
- **Intro:** Practising quantity surveyors, cost and contracts professionals with experience across Qatar, the UAE, Saudi Arabia, Oman and India.
- In the Drive doc's order. Bios are the Drive sentences; the role line is a short title taken from each bio. Photos are in `brand/assets/trainers/`, named from the spelling on the Entri page.
  1. **Shafeer PP**, Commercial and QS professional (`shafeer-p-p.jpg`). FIDIC-trained commercial and QS professional with 22+ years across the UAE, Qatar, India, Saudi Arabia and Oman.
  2. **Swapna Saji**, QS and Planning Manager, Dubai (`swapna-saji.jpg`). QS and Planning Manager in Dubai with 25+ years, from civil engineer to senior QS and planning roles.
  3. **Subul Abdul Assis**, Member of RICS (no photo). Member of the Royal Institution of Chartered Surveyors (RICS), with 19 years across Qatar, the UAE and India.
  4. **Maneesh VS**, Contracts manager (`maneesh-vs.jpg`). Contracts manager with 18+ years of experience.
  5. **Mini Pramod**, Senior contracts and costing manager (`mini-pramod.jpg`). Senior contracts and costing manager with 14+ years on residential, commercial and plotted development projects.
  6. **Reenu Cherian**, Quantity surveyor (`reenu-cherian.jpg`). Quantity surveyor with 12+ years of experience.
  7. **Jubair KV**, CBG trainer (`jubair-kv.jpg`). CBG trainer with 11+ years across the UAE, Qatar, Saudi Arabia and India.
  8. **Nadira Farhath**, Cost estimator (`nadira-farhath.jpg`). Cost estimator with 10+ years of experience.
  9. **Rinsha V**, CBG trainer · UPDA-certified (Qatar) (`rinsha-v.jpg`). UPDA-certified (Qatar) CBG trainer with 8 years across the UAE, Qatar and India.
  10. **Shazia Hafsath**, Quantity surveyor (no photo). Quantity surveyor with 8+ years on projects in India, the UAE and Qatar.
  11. **Fathwin Muhammed**, Quantity surveyor, Dubai (no photo). Quantity surveyor with 7+ years in Dubai, UAE.
  12. **Shuhaida Shamsudin**, Quantity surveyor (`shuhaida-shamsudin.jpg`). Quantity surveyor with 4+ years of experience.
  13. **Nidha Fazli**, Quantity surveyor and CBG trainer (`nidha-fazli.jpg`). Certified quantity surveyor and trainer at CBG.

## [testimonials] In their words
- **Heading:** In their words: learners on the course
- **Intro:** What learners say about the classes, the faculty and the support.
- **Quotes** (word for word from the Entri page, typos included; photos in `brand/assets/students/`):
  1. **Abhirami P A**, Placed at 3EG Consultant LLC (`abhirami-p-a.jpg`): "The support I received from this course reduced my fear of finding a job in another country. Their guidance and resources were instrumental in boosting my confidence for the job search abroad."
  2. **Seneeta Luiz**, Placed at Grid Engineering Consultancy Pvt (`seneeta-luiz.jpg`): "QS course has played a crucial role in helping me understand what quantity surveying is all about. The accessibility of the course materials. Whether on my computer or mobile device, I could easily access the lessons, which made learning convenient and flexible. I was impressed with the quality of content and the user-friendly interface. Also the course modules are well-organized and cover a wide range of topics relevant to quantity surveying."
  3. **Jebin J** (`jebin-j.jpg`): "It's good to be teaching a class. whenever I have any doubts they will solve them immediately. By the end of this class you will be able to read and understand the entire concept of quality surveyor. This will make interview questions easier not only india but also abroad."
- **Small print:** Quoted word for word, as the learners wrote them.
- **Not used:** the other 23 written reviews on the Entri page all mention Entri (one in a Tamil review), so they are left out.
- **Removed 4 Oct 2026 (Maasoom):** Elavenil E (no real photo), Venkat and Majji Suresh (photos carry an Entri graphic).

## [placements] Placement stories
- **Heading:** Placement stories: where learners went next
- **Intro:** Learners from this course and the roles they were placed in, with the company where we know it.
- **People** (59, in Entri's order: name, role as shown · company read from the logo, where legible; photos in `brand/assets/students/`). No company for Ankitha S Kumar (Entri shows the company name, Lee Builders, in her role line), Nikhil Jayachandran, Shaiju Shaji and R Karthick (their logos have no legible name).
1. **Muhammad Fazil**, Civil Engineer · NEOM (`muhammad-fazil.jpg`)
2. **Abdul Zayan**, Cost Auditor · Sobha Constructions (`abdul-zayan.jpg`)
3. **Nikhil Babu**, Quantity Surveyor · Kalliyath TMT (`nikhil-babu.jpg`)
4. **Anaswara V**, Junior Planning Engineer · Sobha Constructions (`anaswara-v.jpg`)
5. **Ankitha S Kumar**, Lee Builders (`ankitha-s-kumar.jpg`)
6. **Noble Sam Louis**, Design Assistant · AXYZ (`noble-sam-louis.jpg`)
7. **Danvin A K**, Site Engineer · KMT Construction (`danvin-a-k.jpg`)
8. **Adithya Jagadeesh**, Quantity Surveyor · Alghanim International (`adithya-jagadeesh.jpg`)
9. **Revathy T A**, Project Manager · Theriyil Associates (`revathy-t-a.jpg`)
10. **Basim Sidan K**, Jr Engineer · Aztec Middle East Contracting LLC (`basim-sidan-k.jpg`)
11. **Ajmal C P**, Planning Engineer · Wade Adams (`ajmal-c-p.jpg`)
12. **Arunkrishna R**, Detailing Engineer · Cadmus Steel (`arunkrishna-r.jpg`)
13. **Pranav Yadav**, Junior Quantity Surveyor · Parsons (`pranav-yadav.jpg`)
14. **Arunima**, Quantity Surveyor · Morrow Homes (`arunima.jpg`)
15. **Malavika**, Quantity Surveyor · R&R Builders (`malavika.jpg`)
16. **Yahya N Z**, Sale Support Engineer · SECON (`yahya-n-z.jpg`)
17. **Adish Prakash K**, Quality Controller · KK Group (`adish-prakash-k.jpg`)
18. **Tijo Joseph**, Site Engineer · PEMS Engineering Consultants (`tijo-joseph.jpg`)
19. **Keerthana K**, Jr Quantity Surveyor · Krishvi (`keerthana-k.jpg`)
20. **Arya V**, Procurement Engineer · Axiom International (`arya-v.jpg`)
21. **Noorah**, QS and Project Support · The Toolkit (`noorah.jpg`)
22. **Navanya Ramesh P**, Quantity Surveyor · Al Doseri Contracting (`navanya-ramesh-p.jpg`)
23. **Karthika Adarsh**, Site's Coordinator · Philco Contracting L.L.C (`karthika-adarsh.jpg`)
24. **Rahiba Yoonus**, Draughtman · Firas Engg. Consultancy (`rahiba-yoonus.jpg`)
25. **Laya Varghese**, Estimation Executive Engineer · Green Interio Fusion Pvt Ltd (`laya-varghese.jpg`)
26. **Riza Rahim**, Quantity Surveyor · Julfar Contracting (`riza-rahim.jpg`)
27. **Blessy Maria Alexander**, Technical Engineer · Buildeasy (`blessy-maria-alexander.jpg`)
28. **Allen Issac**, Estimation Engineer · Mark Comprehensive L.L.C (`allen-issac.jpg`)
29. **Keerthi B**, Planning and Estimation Engineer · Vardhaki Architects & Engineers (`keerthi-b.jpg`)
30. **Dijin D J**, Civil Engineer · Rooh Global Traders (`dijin-d-j.jpg`)
31. **Najah Ahmed Mohamed**, Quantity Surveyor · AIM (`najah-ahmed-mohamed.jpg`)
32. **Nikhil Jayachandran**, Junior Civil Quantity Surveyor (`nikhil-jayachandran.jpg`)
33. **Palepgu Agnivesh Rajiv Chathurvedi**, QS Engineer · Teramor (`palepgu-agnivesh-rajiv-chathurvedi.jpg`)
34. **Kilaru Pawan**, Senior Project Engineer · Vertex (`kilaru-pawan.jpg`)
35. **Guthikonda Sindhu**, Junior Engineer · Vasavi Atlantis (`guthikonda-sindhu.jpg`)
36. **K Naveen Aashish**, Planning Engineer · Gina Engineering Company (P) Ltd (`k-naveen-aashish.jpg`)
37. **Merin George**, Procurement Engineer · Golden Wood (`merin-george.jpg`)
38. **Thangadurai K**, Quantity Surveyor · NSH (`thangadurai-k.jpg`)
39. **Dinesh Kumar**, Quantity Surveyor · Kaylim Holdings Pte Ltd (`dinesh-kumar.jpg`)
40. **Anju Prakash**, Facade Draughtsman Trainee · Latinem Private Limited (`anju-prakash.jpg`)
41. **Ashmina C K**, Quantity Surveyor · Johns Systems (`ashmina-c-k.jpg`)
42. **Aaliya Fathima T K**, Quantity Surveyor · Cochin Building Contracting LLC (`aaliya-fathima-t-k.jpg`)
43. **Shahan Shaj**, Senior executive quality (QC) · Godrej Properties (`shahan-shaj.jpg`)
44. **Shaiju Shaji**, Junior Civil Engineer (`shaiju-shaji.jpg`)
45. **Shamsiya Shukoor**, Estimation Engineer · Advanced Land Drying LLC (`shamsiya-shukoor.jpg`)
46. **Ajay Aravind**, Civil Engineer · Galfar (`ajay-aravind.jpg`)
47. **Shanhan**, Planning Engineer · Abu Dhabi Precast (`shanhan.jpg`)
48. **N S Gopika**, Estimation Engineer · Eallisto (`n-s-gopika.jpg`)
49. **Raja J**, Quantity Surveyor · SJM Projects (`raja-j.jpg`)
50. **Satheesh Kumar**, Manager · Madura Traders (`satheesh-kumar.jpg`)
51. **Kanipandi G**, Senior Project Engineer · Aqwat (`kanipandi-g.jpg`)
52. **Vijayraj M**, Project Engineer · K&K (`vijayraj-m.jpg`)
53. **Tamil Mani Govinthan**, Site Engineer · Bharat Petroleum (`tamil-mani-govinthan.jpg`)
54. **Aravindhan P**, Junior Engineer · Ashoka Buildcon Limited (`aravindhan-p.jpg`)
55. **Kabilan Krishnamoorthy**, Site Engineer · HSL (`kabilan-krishnamoorthy.jpg`)
56. **R Karthick**, Site Engineer (`r-karthick.jpg`)
57. **S Santhoshkumar**, Senior Engineer · Bygging India (`s-santhoshkumar.jpg`)
58. **Sudharshan K S**, Site Engineer · JNR Construction (`sudharshan-k-s.jpg`)
59. **Sam Anil**, Senior Engineer · Adani Renewables (`sam-anil.jpg`)
- **Note:** CBG has supported 500+ placements across Saudi Arabia, the UAE, India, the Maldives and Africa. Placement assistance is not a job guarantee: results depend on your effort, interviews and the market.

## [careers] Where it can take you
- **Intro:** The course prepares you for roles such as these.
- Quantity Surveyor · Estimation or Tendering Engineer · Billing Engineer · Cost Engineer · Contracts Engineer · Planning Engineer · Procurement Engineer

## [faq] Student FAQ
All 14 from the Drive copy, word for word.
1. **Who is this course for?** Civil engineering graduates, freshers and working professionals, such as site engineers, who want a career in quantity surveying, estimation, billing or cost control. You need a background in civil engineering, good numeracy and basic computer skills.
2. **What does a quantity surveyor do?** A quantity surveyor manages the cost and contract side of a construction project. That means measuring quantities, preparing BOQs and estimates, pricing work, preparing bills and payment certificates, valuing variations and keeping the project within budget, working closely with architects, engineers and contractors.
3. **Can a civil engineer become a quantity surveyor?** Yes. Civil engineers already understand construction, materials and site execution, which makes the move into quantity surveying a natural one. This course adds the measurement, commercial and contract skills on top.
4. **How long is the course and when are classes held?** The course runs for 8 months: 55 hours of technical sessions plus 3 hours of HR and CV sessions. Classes are on alternate days, in Monday, Wednesday and Friday or Tuesday, Thursday and Saturday batches. Your batch timetable is shared when you join.
5. **How is the course structured?** After a Start Here orientation, the course runs through 8 modules in the order you meet the work on a real project: QS Foundations; Measurement and BOQ; Estimating and Cost Planning; Tendering and Contracts; Post-Contract Billing; Cost Control and Planning; Closeout and Live Project; and Career Launch. It starts with the basics, including Excel and AutoCAD, and builds step by step, with assignments along the way so you learn by doing.
6. **Are the classes live or recorded?** Classes are taught live online by CBG faculty, so you can ask questions as you go. Recorded sessions let you revisit topics. Live attendance still matters: you need at least 75% to qualify for your certificates.
7. **What software do I need?** A laptop or PC with a stable internet connection. You will use Excel, AutoCAD, PlanSwift and Primavera P6 during the course, so make sure you can run them before the topics that use them. Message CBG if you need help getting set up.
8. **How are assignments submitted and evaluated?** There are 11 assignments plus 2 CV submissions, each with its own deadline (3 to 21 days after the class). Submit them in the format the brief asks for, for example XLSX for BOQs and billing, DWG plus PDF for AutoCAD and XER plus PDF for Primavera. CBG faculty review your work and return feedback within 15 working days.
9. **What certificates will I receive?** Three CBG certificates: a Course Completion Certificate and two Live Project Certificates. To qualify you need at least 75% live class attendance, all assignments completed with 70% or above for quality, and at least 80% of the course content completed.
10. **What are the live projects?** Real project work from CBG's engineering services division in the Middle East. You prepare civil and fit-out BOQs from live project drawings, guided by CBG faculty, and earn two Live Project Certificates.
11. **Do you offer placement assistance?** Yes. Learners who complete the course, keep at least 75% live attendance, finish their assignments and pass the mock interviews receive relevant job openings and interview support. CBG has supported 500+ placements across Saudi Arabia, the UAE, India, the Maldives and Africa. Placement assistance is not a job guarantee: results depend on your effort, interviews and the market.
12. **How does the CV review work?** CV session 1 shows you how to build a high-impact CV and gives you access to CBG's AI CV builder (cvbuilder.carbonblueglobal.com). You submit your first CV within 7 days, attend CV session 2, then submit a revised CV within 7 days. CBG reviews it line by line, and the review and revision loop continues until your CV is final.
13. **What if I get stuck between classes?** Each topic has a WhatsApp doubt-clearance line, and you can request a one-to-one session with faculty. Your mentor can take any unresolved issue to CBG for you.
14. **How do I enrol?** Enrolment is by invitation. Message CBG on WhatsApp at +974 7048 5638 and our team will guide you through the next steps.

## [help] Help and contacts (closing band)
- **Heading:** Stuck on anything? Message us.
- **WhatsApp:** +974 7048 5638 · **Email:** info@carbonblueglobal.com (from the syllabus header)
- **Small logos:** the CBG mark only

---

## Points for Maasoom to confirm
- **Take-off numbers (hero):** the five rows are illustrative quantities for a small two-storey villa, not from a CBG project. Approve, change or replace them.
- **X-ray labels:** "Stirrups" and "Main bars" are standard BBS terms but are not named word for word in the syllabus (it says "general bar shapes"); the other three are. Label points are guesses until the pictures exist.
- **Certificates:** shown as two cards (Course Completion, and the two Live Project Certificates together), because the Drive copy still has open what earns each Live Project Certificate. No sample pictures until CBG has its own unbranded samples.
- **Placement companies read from logos:** "AXYZ" (stylised letters), "Vertex" (the logo reads "Vertex, Living Modernised") and "Vasavi Atlantis" (Vasavi mark with "Atlantis") are the least certain. Ankitha S Kumar's role is "Lee Builders" exactly as Entri shows it.
- **Testimonials:** only 6 written reviews qualify; Elavenil E shows initials (Entri has a generic avatar for her).
- **Faculty role lines** are short titles taken from each Drive bio (e.g. "Member of RICS" for Subul Abdul Assis). The open faculty points in the Drive doc (years, all 13 still teaching, RICS and UPDA current) still apply.
- **Card chips:** the languages (Malayalam, Telugu, Tamil) come from the course-list workbook, not the Drive copy.
