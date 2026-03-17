
-- ============================================================
-- STEP 1: Fix duplicate categories by reassigning courses
-- ============================================================

-- Reassign courses from duplicate "Health & Safety" (a1b2c3d4) to canonical (d5b7031f)
UPDATE courses SET category_id = 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74'
WHERE category_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- Reassign "Underage Sales" from duplicate "Compliance" (1487d971) to "Legal Compliance" (08bda676)
UPDATE courses SET category_id = '08bda676-2af9-4f15-89e2-6f3db75881dc'
WHERE category_id = '1487d971-646b-4685-bc80-22508cd2fae4';

-- Reassign "Food Safety Level 2" from duplicate "Compliance" (c3d4e5f6) to "Food Safety" (9e8019f7)
UPDATE courses SET category_id = '9e8019f7-96b9-4708-aece-075f65c93a69'
WHERE category_id = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

-- Reassign "Saving Energy" from "Environment & Sustainability" (f28bc41b) to "Environmental" (f82e7b7c)
UPDATE courses SET category_id = 'f82e7b7c-0f01-474b-a26d-e70d193a2bc2'
WHERE category_id = 'f28bc41b-7648-4257-b7d7-58285696a3d3';

-- Delete duplicate/unused categories
DELETE FROM course_categories WHERE id IN (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '1487d971-646b-4685-bc80-22508cd2fae4',
  'c3d4e5f6-a7b8-9012-cdef-123456789012',
  'f28bc41b-7648-4257-b7d7-58285696a3d3',
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'd4e5f6a7-b8c9-0123-defa-234567890123'
);

-- ============================================================
-- STEP 2: Add 11 new courses (courses 30-40)
-- ============================================================

-- Course 30: Infection Control & Prevention
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Infection Control & Prevention', 'Comprehensive training on infection prevention and control measures in the workplace, covering hygiene protocols, PPE usage, and outbreak management.', 'published', 'interactive', 30, 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74', true, 80, 'intermediate', 130);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Understanding Infections', 'How infections spread and key terminology', 1),
  (m2, c_id, 'Prevention & Control Measures', 'Practical steps to prevent infection transmission', 2),
  (m3, c_id, 'Outbreak Management', 'Responding to and managing infection outbreaks', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Chain of Infection', '[{"type":"heading","content":"The Chain of Infection"},{"type":"paragraph","content":"Understanding the six links in the chain of infection is fundamental to breaking the cycle of transmission."},{"type":"highlight","content":"The six links: Infectious Agent, Reservoir, Portal of Exit, Mode of Transmission, Portal of Entry, Susceptible Host."},{"type":"paragraph","content":"Breaking any single link in the chain can prevent infection from spreading to new hosts."}]', 1, 5),
  (m1, 'Types of Pathogens', '[{"type":"heading","content":"Common Workplace Pathogens"},{"type":"paragraph","content":"Bacteria, viruses, fungi, and parasites each require different control strategies."},{"type":"bullets","content":["Bacteria: E. coli, Salmonella, MRSA","Viruses: Norovirus, Influenza, COVID-19","Fungi: Aspergillus, Candida","Parasites: Cryptosporidium, Giardia"]},{"type":"note","content":"Norovirus is the most common cause of gastroenteritis outbreaks in UK workplaces."}]', 2, 5),
  (m2, 'Hand Hygiene Standards', '[{"type":"heading","content":"WHO 5 Moments for Hand Hygiene"},{"type":"paragraph","content":"Effective hand hygiene is the single most important measure for preventing the spread of infection."},{"type":"highlight","content":"Hands must be washed for a minimum of 20 seconds using soap and warm running water."},{"type":"bullets","content":["Before touching food or clean equipment","After using the toilet","After touching contaminated surfaces","After removing gloves or PPE","Between serving different customers"]}]', 1, 5),
  (m2, 'PPE for Infection Control', '[{"type":"heading","content":"Personal Protective Equipment"},{"type":"paragraph","content":"PPE acts as a barrier between the worker and infectious agents when other controls are insufficient."},{"type":"bullets","content":["Disposable gloves for contact with bodily fluids","Face masks/respirators for airborne pathogens","Aprons and gowns for splash protection","Eye protection when risk of splashes exists"]},{"type":"note","content":"PPE must be donned and doffed in the correct order to prevent self-contamination."}]', 2, 5),
  (m3, 'Recognising an Outbreak', '[{"type":"heading","content":"Outbreak Detection and Reporting"},{"type":"paragraph","content":"An outbreak is defined as two or more linked cases of the same illness."},{"type":"highlight","content":"Report suspected outbreaks immediately to your line manager and Environmental Health."},{"type":"bullets","content":["Monitor absence patterns for clusters of similar symptoms","Document all suspected cases with dates and symptoms","Preserve any suspected food or environmental samples","Isolate affected areas if possible"]}]', 1, 5),
  (m3, 'Decontamination Procedures', '[{"type":"heading","content":"Cleaning, Disinfection & Sterilisation"},{"type":"paragraph","content":"Different levels of decontamination are required depending on the risk level and type of pathogen."},{"type":"bullets","content":["Cleaning: Physical removal of organic matter and dirt","Disinfection: Reduction of viable organisms to a safe level","Sterilisation: Complete destruction of all microorganisms"]},{"type":"note","content":"Always clean before disinfecting, as organic matter can inactivate many disinfectants."}]', 2, 5);
END $$;

-- Course 31: Electrical Safety Awareness
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Electrical Safety Awareness', 'Training on the Electricity at Work Regulations 1989, covering hazard recognition, safe working practices, and PAT testing requirements.', 'published', 'step_by_step', 30, 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74', true, 80, 'intermediate', 130);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Electrical Hazards', 'Understanding risks from electricity in the workplace', 1),
  (m2, c_id, 'Safe Working Practices', 'Procedures for working safely with electrical equipment', 2),
  (m3, c_id, 'Inspection & Testing', 'PAT testing and visual inspection requirements', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'How Electricity Can Harm', '[{"type":"heading","content":"Dangers of Electricity"},{"type":"paragraph","content":"Electricity can kill or severely injure. Even relatively low voltages can be fatal under certain conditions."},{"type":"highlight","content":"Around 30 people die each year in the UK from electrical accidents at work."},{"type":"bullets","content":["Electric shock causing cardiac arrest","Electrical burns (internal and external)","Falls from height triggered by electric shock","Fires caused by electrical faults","Arcing and explosion injuries"]}]', 1, 5),
  (m1, 'Common Electrical Hazards', '[{"type":"heading","content":"Workplace Electrical Hazards"},{"type":"bullets","content":["Damaged or frayed cables and leads","Overloaded sockets and extension leads","Water near electrical equipment","Poorly maintained portable appliances","Exposed wiring or missing covers","Incorrect fuse ratings"]},{"type":"note","content":"Under the Electricity at Work Regulations 1989, employers must ensure all electrical systems are safe and properly maintained."}]', 2, 5),
  (m2, 'Safe Use of Equipment', '[{"type":"heading","content":"Electrical Equipment Best Practices"},{"type":"paragraph","content":"Simple precautions can prevent the majority of electrical accidents in the workplace."},{"type":"bullets","content":["Always visually inspect equipment before use","Never use damaged cables, plugs, or sockets","Switch off and unplug before cleaning equipment","Keep liquids away from electrical equipment","Use RCD protection for portable equipment outdoors","Never overload sockets or daisy-chain extension leads"]},{"type":"highlight","content":"If equipment is faulty, label it DO NOT USE, remove from service, and report it immediately."}]', 1, 5),
  (m2, 'Emergency Response', '[{"type":"heading","content":"Responding to Electrical Incidents"},{"type":"paragraph","content":"Speed of response to electrical incidents can mean the difference between life and death."},{"type":"highlight","content":"NEVER touch someone who is in contact with a live electrical source."},{"type":"bullets","content":["Isolate the power supply if safe to do so","Call emergency services immediately (999)","If the person is free from the source, check breathing and pulse","Begin CPR if trained and the person is unresponsive","Treat electrical burns with cool running water"]}]', 2, 5),
  (m3, 'PAT Testing Requirements', '[{"type":"heading","content":"Portable Appliance Testing"},{"type":"paragraph","content":"PAT testing is the examination of electrical appliances and equipment to ensure they are safe to use."},{"type":"bullets","content":["Class I equipment: requires earth continuity testing","Class II equipment: double insulated, no earth required","Testing frequency depends on equipment type and environment","Records must be kept of all inspections and tests"]},{"type":"note","content":"There is no legal requirement for PAT testing at fixed intervals, but the HSE recommends a risk-based approach to inspection frequency."}]', 1, 5),
  (m3, 'Visual Inspection Checklist', '[{"type":"heading","content":"User Checks Before Use"},{"type":"paragraph","content":"Over 95% of electrical faults can be detected through simple visual inspection."},{"type":"bullets","content":["Check plug for damage, cracks, or burn marks","Inspect cable for cuts, fraying, or exposed wires","Ensure cable grip is secure at plug and appliance","Check for signs of overheating or scorch marks","Verify the correct fuse rating is installed","Confirm PAT test label is in date"]}]', 2, 5);
END $$;

-- Course 32: Workplace Violence & Aggression
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Workplace Violence & Aggression', 'Essential training on recognising, preventing, and responding to violence and aggression in retail and customer-facing environments.', 'published', 'classic', 35, 'ad2ed637-e890-4c99-ae42-83b55f7166e9', true, 80, 'advanced', 150);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Understanding Violence & Aggression', 'Types, causes, and risk factors', 1),
  (m2, c_id, 'Prevention & De-escalation', 'Techniques to prevent and manage situations', 2),
  (m3, c_id, 'Post-Incident Response', 'Support and reporting after incidents', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Defining Workplace Violence', '[{"type":"heading","content":"What Constitutes Workplace Violence"},{"type":"paragraph","content":"The HSE defines work-related violence as any incident in which a person is abused, threatened, or assaulted in circumstances relating to their work."},{"type":"bullets","content":["Physical assault (pushing, hitting, spitting)","Verbal abuse, threats, and intimidation","Harassment and stalking behaviour","Armed robbery or theft-related violence","Racial, sexual, or discriminatory abuse"]},{"type":"highlight","content":"Retail workers are among the most at-risk occupational groups, with over 450 incidents per day reported across UK retail."}]', 1, 6),
  (m1, 'Risk Factors & Triggers', '[{"type":"heading","content":"Common Triggers in Retail"},{"type":"bullets","content":["Age verification challenges (alcohol, tobacco, knives)","Refunds and complaints handling","Suspected shoplifting confrontations","Queue frustration and waiting times","Intoxicated or drug-affected individuals","Mental health crises"]},{"type":"note","content":"Understanding triggers helps staff anticipate and prepare for potentially volatile situations."}]', 2, 6),
  (m2, 'Dynamic Risk Assessment', '[{"type":"heading","content":"Assessing Threat in Real Time"},{"type":"paragraph","content":"Dynamic risk assessment is a continuous process of evaluating danger as situations evolve."},{"type":"bullets","content":["Observe body language: clenched fists, pacing, raised voice","Assess the environment: exits, barriers, nearby staff","Evaluate your own position: distance, escape routes","Consider the individual: intoxication, weapons, group size"]},{"type":"highlight","content":"Your safety always comes first. No product or policy is worth risking your wellbeing."}]', 1, 6),
  (m2, 'Verbal De-escalation Techniques', '[{"type":"heading","content":"Calming Aggressive Individuals"},{"type":"bullets","content":["Use a calm, low, steady tone of voice","Acknowledge their frustration without agreeing","Use open body language, keep hands visible","Avoid direct eye contact which can seem confrontational","Offer alternatives and choices where possible","Set clear, respectful boundaries"]},{"type":"note","content":"The LEAPS model: Listen, Empathise, Ask, Paraphrase, Summarise is an effective framework for de-escalation."}]', 2, 6),
  (m3, 'Reporting & Documentation', '[{"type":"heading","content":"Post-Incident Procedures"},{"type":"paragraph","content":"All incidents of violence and aggression must be reported, regardless of severity."},{"type":"bullets","content":["Complete an incident report within 24 hours","Report to police if criminal offence occurred","RIDDOR reporting for injuries causing 7+ days absence","Preserve CCTV footage as evidence","Record witness details and statements"]},{"type":"highlight","content":"Under RIDDOR, acts of physical violence resulting in injury must be reported to the HSE."}]', 1, 5),
  (m3, 'Staff Wellbeing & Support', '[{"type":"heading","content":"Supporting Affected Staff"},{"type":"paragraph","content":"The psychological impact of workplace violence can be significant and long-lasting."},{"type":"bullets","content":["Immediate welfare check and time to recover","Access to Employee Assistance Programme (EAP)","Debrief with manager within 48 hours","Consider temporary role adjustments if needed","Monitor for signs of PTSD or anxiety","Maintain confidentiality throughout the process"]}]', 2, 6);
END $$;

-- Course 33: Age Verification & Responsible Retailing
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Age Verification & Responsible Retailing', 'Complete training on Challenge 25, acceptable ID, and legal responsibilities for age-restricted product sales.', 'published', 'interactive', 30, '08bda676-2af9-4f15-89e2-6f3db75881dc', true, 80, 'beginner', 120);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Legal Framework', 'Laws governing age-restricted sales in the UK', 1),
  (m2, c_id, 'Challenge 25 in Practice', 'Implementing the Challenge 25 policy effectively', 2),
  (m3, c_id, 'Difficult Situations', 'Handling refusals and proxy sales', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Age-Restricted Products', '[{"type":"heading","content":"UK Age Restrictions"},{"type":"bullets","content":["Alcohol: 18+ (Licensing Act 2003)","Tobacco & Vaping: 18+ (Children & Young Persons Act 1933)","Knives & Blades: 18+ (Criminal Justice Act 1988)","Fireworks: 18+ for adult fireworks, 16+ for sparklers (Fireworks Act 2003)","Lottery tickets: 18+ (National Lottery Act 1993)","Solvents & Aerosols: 18+ (Intoxicating Substances Act 1985)"]},{"type":"highlight","content":"Personal liability: staff can face unlimited fines and criminal prosecution for illegal sales."}]', 1, 5),
  (m1, 'Penalties & Consequences', '[{"type":"heading","content":"Consequences of Non-Compliance"},{"type":"bullets","content":["Individual fines up to 5,000 GBP for staff","Premises licence review or revocation","Criminal record for the individual seller","Business reputation damage","Loss of employment"]},{"type":"note","content":"Due diligence is a defence only if you can prove reasonable steps were taken, such as asking for ID."}]', 2, 5),
  (m2, 'Acceptable Forms of ID', '[{"type":"heading","content":"Approved Identification Documents"},{"type":"paragraph","content":"Only certain forms of ID should be accepted when verifying age."},{"type":"bullets","content":["UK or EU Passport","UK Driving Licence (full or provisional)","PASS-accredited proof of age card","Military ID card"]},{"type":"highlight","content":"Do NOT accept: student cards, work ID badges, foreign driving licences (without PASS), or social media profiles as proof of age."}]', 1, 5),
  (m2, 'Making the Challenge', '[{"type":"heading","content":"How to Challenge Effectively"},{"type":"paragraph","content":"Challenge 25 means if the customer appears under 25, you must request ID."},{"type":"bullets","content":["Be polite and professional at all times","Explain it is company policy and legal requirement","Ask clearly: May I see your ID please?","Check the ID carefully: photo, date of birth, hologram","If no valid ID, refuse the sale politely","Record all challenges in the refusals log"]}]', 2, 5),
  (m3, 'Handling Refusals', '[{"type":"heading","content":"Refusing a Sale Safely"},{"type":"paragraph","content":"Refusals can provoke negative reactions. Staff must be prepared to handle these calmly."},{"type":"bullets","content":["Remain calm, polite, and firm","Explain you are legally unable to make the sale","Do not debate or negotiate","Offer to serve them if they return with valid ID","Call a manager if the customer becomes aggressive","Record the refusal in the log immediately"]}]', 1, 5),
  (m3, 'Proxy Sales & Group Challenges', '[{"type":"heading","content":"Identifying Proxy Purchases"},{"type":"paragraph","content":"A proxy sale occurs when an adult purchases age-restricted products on behalf of an underage person."},{"type":"highlight","content":"If you suspect a proxy purchase, you have the right and duty to refuse the sale."},{"type":"bullets","content":["Watch for adults conferring with younger people outside","Be alert to unusual purchasing patterns","Challenge the buyer if you suspect proxy purchasing","It is illegal to buy alcohol for someone under 18 (except specific exceptions)","Record all suspected proxy sale refusals"]}]', 2, 5);
END $$;

-- Course 34: Cash Handling & Till Security
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Cash Handling & Till Security', 'Best practices for cash handling, counterfeit detection, and till security procedures to minimise losses and prevent fraud.', 'published', 'step_by_step', 30, '47b43f99-9bcf-448c-920e-552a20c21eb8', true, 80, 'beginner', 120);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Cash Handling Procedures', 'Correct procedures for handling cash transactions', 1),
  (m2, c_id, 'Counterfeit Detection', 'Identifying fake currency and payment fraud', 2),
  (m3, c_id, 'Till Security & Loss Prevention', 'Protecting against theft and till shortages', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Opening & Closing Procedures', '[{"type":"heading","content":"Till Float Management"},{"type":"paragraph","content":"Consistent opening and closing procedures are essential for accurate cash management."},{"type":"bullets","content":["Count the float before opening, verify against the record","Two-person verification for large floats","Never leave the till unattended while open","Count takings at end of shift with a witness","Record all discrepancies immediately","Secure cash in the safe promptly at close"]},{"type":"highlight","content":"All float counts must be verified by two members of staff and signed off."}]', 1, 5),
  (m1, 'Transaction Best Practices', '[{"type":"heading","content":"Handling Cash Transactions Safely"},{"type":"bullets","content":["Place customer note on the till ledge until change is given","Count change back to the customer aloud","Never put customer cash in the till before giving change","Keep large notes visible until transaction is complete","Issue receipts for every transaction","Report any quick-change scam attempts immediately"]},{"type":"note","content":"The till ledge technique prevents disputes about which denomination the customer handed over."}]', 2, 5),
  (m2, 'Checking Banknotes', '[{"type":"heading","content":"Bank of England Security Features"},{"type":"paragraph","content":"UK polymer banknotes have multiple security features that are difficult to replicate."},{"type":"bullets","content":["Feel: Raised print on the front of the note","Look: Check the see-through window and hologram","Tilt: Observe colour-changing patches","UV: Genuine notes glow under UV light","Watermark: Hold to light to see the portrait"]},{"type":"highlight","content":"If you suspect a counterfeit note, do not return it. Follow your store policy for handling suspected counterfeits."}]', 1, 5),
  (m2, 'Payment Fraud Awareness', '[{"type":"heading","content":"Common Payment Fraud Methods"},{"type":"bullets","content":["Quick-change artists who confuse with rapid exchanges","Distraction techniques while handling cash","Stolen or cloned payment cards","Contactless card fraud using lost/stolen cards","Refund fraud using counterfeit receipts"]},{"type":"note","content":"Report all suspected fraud to your manager and retain CCTV footage where available."}]', 2, 5),
  (m3, 'Preventing Till Shortages', '[{"type":"heading","content":"Common Causes & Prevention"},{"type":"paragraph","content":"Till shortages can result from genuine error or deliberate theft. Good procedures minimise both."},{"type":"bullets","content":["Use individual till logins, never share passwords","Close the till drawer between each transaction","Do not keep personal money in the till area","Report any unexplained shortages immediately","Conduct random till checks during shifts","Review CCTV if persistent shortages occur"]}]', 1, 5),
  (m3, 'Cash-in-Transit Security', '[{"type":"heading","content":"Banking & Cash Transfers"},{"type":"paragraph","content":"Moving cash between the till, safe, and banking collection points presents significant security risks."},{"type":"bullets","content":["Vary banking times and routes where possible","Use tamper-evident banking bags","Two-person rule for safe access","Record all safe deposits and withdrawals","Never discuss banking schedules publicly","Follow CIT provider instructions precisely"]},{"type":"highlight","content":"Never attempt to resist an armed robbery. Comply with demands, activate the alarm when safe, and preserve evidence."}]', 2, 5);
END $$;

-- Course 35: Emergency Evacuation Procedures
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Emergency Evacuation Procedures', 'Comprehensive training on workplace emergency planning, evacuation procedures, and the role of fire marshals under UK regulations.', 'published', 'visual', 30, 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74', true, 80, 'beginner', 120);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Emergency Planning', 'Legal requirements and planning frameworks', 1),
  (m2, c_id, 'Evacuation Procedures', 'Step-by-step evacuation processes', 2),
  (m3, c_id, 'Roles & Responsibilities', 'Fire marshal and first aider duties during emergencies', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Legal Requirements', '[{"type":"heading","content":"Regulatory Reform (Fire Safety) Order 2005"},{"type":"paragraph","content":"Every employer must have an emergency plan appropriate to the size and nature of their premises."},{"type":"bullets","content":["Fire risk assessment must be reviewed annually","Emergency routes and exits must be kept clear","Emergency lighting and signage requirements","Regular fire drills (minimum twice per year)","Personal Emergency Evacuation Plans (PEEPs) for disabled staff"]},{"type":"highlight","content":"The Responsible Person (usually the employer) is legally accountable for fire safety."}]', 1, 5),
  (m1, 'Types of Emergencies', '[{"type":"heading","content":"Scenarios Requiring Evacuation"},{"type":"bullets","content":["Fire or smoke detection","Gas leak or chemical spill","Bomb threat or suspicious package","Structural damage or collapse risk","Flooding or severe weather","Security threat (hostile intruder)"]},{"type":"note","content":"Each type of emergency may require different responses. Know your premises-specific procedures."}]', 2, 5),
  (m2, 'Hearing the Alarm', '[{"type":"heading","content":"Immediate Actions on Alarm Activation"},{"type":"bullets","content":["Stop what you are doing immediately","Do NOT collect personal belongings","Leave by the nearest available exit","Do NOT use lifts during evacuation","Walk calmly but quickly, do not run","Close doors behind you as you leave","Proceed directly to the assembly point"]},{"type":"highlight","content":"Never assume it is a false alarm. Treat every alarm activation as a real emergency."}]', 1, 5),
  (m2, 'Assembly Points & Roll Call', '[{"type":"heading","content":"Post-Evacuation Procedures"},{"type":"paragraph","content":"Assembly points are designated safe areas where headcounts can be conducted."},{"type":"bullets","content":["Report to your designated assembly point","Fire marshals conduct roll call using staff lists","Report any missing persons to the fire marshal","Do NOT re-enter the building until authorised","Visitors and contractors must be accounted for","Wait for the all-clear from the senior fire marshal"]}]', 2, 5),
  (m3, 'Fire Marshal Duties', '[{"type":"heading","content":"Role of the Fire Marshal"},{"type":"paragraph","content":"Fire marshals are trained staff members with specific responsibilities during evacuations."},{"type":"bullets","content":["Sweep designated areas to ensure full evacuation","Check toilets, break rooms, and storage areas","Assist anyone with mobility difficulties","Report area status to the chief fire marshal","Account for all staff in their zone","Liaise with fire service on arrival"]},{"type":"note","content":"Businesses should have at least one fire marshal per floor or zone, plus cover for absence."}]', 1, 5),
  (m3, 'Supporting Vulnerable People', '[{"type":"heading","content":"Personal Emergency Evacuation Plans"},{"type":"paragraph","content":"PEEPs are individual plans for anyone who may need assistance during an evacuation."},{"type":"bullets","content":["Staff with mobility impairments","Pregnant employees","Staff with visual or hearing impairments","Temporary disabilities (broken limbs, surgery recovery)","Visitors with disabilities"]},{"type":"highlight","content":"PEEPs must be reviewed regularly, especially when circumstances change, and shared with relevant staff."}]', 2, 5);
END $$;

-- Course 36: Personal Protective Equipment (PPE)
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Personal Protective Equipment', 'Training on the PPE at Work Regulations 2022, covering selection, use, maintenance, and legal duties around personal protective equipment.', 'published', 'microlearning', 30, 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74', true, 80, 'beginner', 120);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'PPE Regulations & Types', 'Legal framework and categories of PPE', 1),
  (m2, c_id, 'Selection & Fit', 'Choosing and fitting the right PPE', 2),
  (m3, c_id, 'Maintenance & Storage', 'Care, inspection, and replacement of PPE', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'PPE at Work Regulations 2022', '[{"type":"heading","content":"Legal Framework"},{"type":"paragraph","content":"The Personal Protective Equipment at Work Regulations 2022 extended employer duties to provide PPE to all workers, including limb (b) workers."},{"type":"bullets","content":["PPE is the last resort in the hierarchy of controls","Employer must provide PPE free of charge","Workers must be trained in correct use","PPE must be CE or UKCA marked","Risk assessment determines PPE requirements"]},{"type":"highlight","content":"PPE should only be used when risks cannot be adequately controlled by other means."}]', 1, 5),
  (m1, 'Categories of PPE', '[{"type":"heading","content":"Types of Protection"},{"type":"bullets","content":["Head protection: hard hats, bump caps","Eye protection: safety glasses, goggles, face shields","Hearing protection: ear plugs, ear defenders","Respiratory protection: masks, respirators","Hand protection: gloves (chemical, cut, thermal)","Foot protection: safety boots, anti-slip shoes","Body protection: hi-vis, aprons, overalls"]},{"type":"note","content":"Different workplace hazards require different PPE. One size does not fit all."}]', 2, 5),
  (m2, 'PPE Risk Assessment', '[{"type":"heading","content":"Selecting Appropriate PPE"},{"type":"paragraph","content":"A PPE risk assessment must identify the hazards, evaluate the risks, and determine the appropriate PPE."},{"type":"bullets","content":["Identify the hazard (chemical, physical, biological)","Assess who is at risk and how","Review existing control measures","Determine if PPE is necessary as additional protection","Select PPE that provides adequate protection","Ensure compatibility if multiple PPE items are needed"]}]', 1, 5),
  (m2, 'Correct Fitting & Use', '[{"type":"heading","content":"Ensuring PPE Works Effectively"},{"type":"bullets","content":["PPE must fit the individual correctly","Face-fit testing required for tight-fitting respirators","Adjustable PPE should be fitted before each use","Incompatible PPE items must not be worn together","Staff must be trained in donning and doffing procedures"]},{"type":"highlight","content":"Poorly fitting PPE can be worse than no PPE as it creates a false sense of security."}]', 2, 5),
  (m3, 'Inspection & Replacement', '[{"type":"heading","content":"PPE Maintenance Schedules"},{"type":"paragraph","content":"PPE must be inspected regularly and replaced when damaged, expired, or no longer effective."},{"type":"bullets","content":["Visual inspection before every use","Formal inspection at intervals defined by manufacturer","Replace immediately if damaged or contaminated","Follow manufacturer cleaning instructions","Keep records of PPE inspections and replacements"]},{"type":"note","content":"Hard hats should be replaced every 3-5 years even without visible damage, as UV exposure degrades the material."}]', 1, 5),
  (m3, 'Storage & Hygiene', '[{"type":"heading","content":"Caring for PPE"},{"type":"bullets","content":["Store PPE in clean, dry, designated areas","Keep away from direct sunlight and heat sources","Do not share PPE between workers without sanitisation","Replace disposable PPE after each use","Clean reusable PPE according to manufacturer guidelines","Report lost or damaged PPE immediately for replacement"]}]', 2, 5);
END $$;

-- Course 37: Food Safety & Hygiene Level 3
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid; m4 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid(); m4 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Food Safety & Hygiene Level 3', 'Advanced food safety training for supervisors and managers covering HACCP principles, food safety management systems, and regulatory compliance.', 'published', 'classic', 40, '9e8019f7-96b9-4708-aece-075f65c93a69', true, 80, 'advanced', 160);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Food Safety Legislation', 'UK and EU food safety regulatory framework', 1),
  (m2, c_id, 'HACCP Principles', 'Hazard Analysis and Critical Control Points system', 2),
  (m3, c_id, 'Microbiological Hazards', 'Advanced understanding of foodborne pathogens', 3),
  (m4, c_id, 'Food Safety Management', 'Implementing and auditing food safety systems', 4);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'UK Food Safety Legislation', '[{"type":"heading","content":"Regulatory Framework"},{"type":"paragraph","content":"Food businesses in the UK must comply with multiple pieces of legislation."},{"type":"bullets","content":["Food Safety Act 1990: overarching food safety law","Food Safety & Hygiene (England) Regulations 2013","Regulation (EC) 852/2004: general food hygiene rules","Food Information Regulations 2014: allergen labelling","Food Hygiene Rating Scheme (voluntary but displayed)"]},{"type":"highlight","content":"Due diligence is the primary defence under the Food Safety Act 1990. Businesses must prove they took all reasonable precautions."}]', 1, 5),
  (m1, 'Enforcement & Penalties', '[{"type":"heading","content":"Environmental Health Enforcement"},{"type":"bullets","content":["Improvement Notices: requiring specific corrections","Prohibition Notices: closing premises or stopping processes","Emergency Prohibition Notices: immediate closure","Prosecution: unlimited fines and up to 2 years imprisonment","Hygiene Emergency Prohibition Orders: court-issued closure"]},{"type":"note","content":"Environmental Health Officers have the right to enter food premises at any reasonable time without notice."}]', 2, 5),
  (m2, 'The 7 HACCP Principles', '[{"type":"heading","content":"HACCP Framework"},{"type":"bullets","content":["1. Conduct hazard analysis","2. Determine Critical Control Points (CCPs)","3. Establish critical limits for each CCP","4. Establish monitoring procedures","5. Establish corrective actions","6. Establish verification procedures","7. Establish documentation and record keeping"]},{"type":"highlight","content":"HACCP is a legal requirement for all food businesses under Regulation (EC) 852/2004."}]', 1, 5),
  (m2, 'Critical Control Points', '[{"type":"heading","content":"Identifying and Managing CCPs"},{"type":"paragraph","content":"A CCP is a step where control can be applied to prevent, eliminate, or reduce a food safety hazard to an acceptable level."},{"type":"bullets","content":["Cooking temperatures (core temp 75C for 30 seconds)","Chilling (below 8C, ideally 5C or below)","Hot holding (above 63C)","Delivery acceptance checks","Cross-contamination prevention points"]},{"type":"note","content":"Use the CCP Decision Tree to systematically determine whether a step is a CCP."}]', 2, 5),
  (m3, 'High-Risk Pathogens', '[{"type":"heading","content":"Foodborne Pathogens of Concern"},{"type":"bullets","content":["Campylobacter: UK leading cause, poultry-associated","Salmonella: eggs, poultry, onset 12-72 hours","E. coli O157: severe, can cause kidney failure","Listeria monocytogenes: high mortality rate, ready-to-eat foods","Clostridium perfringens: bulk cooking, inadequate cooling","Norovirus: highly infectious, person-to-person transmission"]},{"type":"highlight","content":"Campylobacter is responsible for approximately 500,000 cases of food poisoning in the UK each year."}]', 1, 5),
  (m3, 'Bacterial Growth & Control', '[{"type":"heading","content":"Conditions for Bacterial Growth"},{"type":"paragraph","content":"Understanding bacterial growth conditions is essential for effective food safety management."},{"type":"bullets","content":["Temperature: Danger zone 8C to 63C","Time: Bacteria double every 10-20 minutes in ideal conditions","Moisture: High water activity foods are highest risk","pH: Most bacteria prefer neutral pH (6.6-7.5)","Oxygen: Aerobic vs anaerobic pathogens","Nutrients: High-protein foods are highest risk"]}]', 2, 5),
  (m4, 'Auditing Food Safety Systems', '[{"type":"heading","content":"Internal Audits & Compliance"},{"type":"paragraph","content":"Regular internal audits ensure food safety systems remain effective and compliant."},{"type":"bullets","content":["Schedule audits at planned intervals","Use standardised audit checklists","Review HACCP documentation and records","Observe staff practices during operations","Check temperature monitoring records","Verify cleaning schedules are followed","Document findings and corrective actions"]}]', 1, 5),
  (m4, 'Staff Training & Supervision', '[{"type":"heading","content":"Training Requirements for Supervisors"},{"type":"paragraph","content":"Level 3 food safety supervisors are responsible for ensuring staff maintain food safety standards."},{"type":"bullets","content":["Identify training needs for all food handlers","Deliver or arrange appropriate training","Monitor and assess staff competence","Maintain training records","Implement corrective actions for non-compliance","Lead by example in food safety practices"]},{"type":"highlight","content":"All food handlers must receive adequate supervision and instruction appropriate to their work activities."}]', 2, 5);
END $$;

-- Course 38: DSEAR (Dangerous Substances & Explosive Atmospheres)
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: DSEAR & Hazardous Substances', 'Training on the Dangerous Substances and Explosive Atmospheres Regulations 2002, covering fuel safety, hazardous storage, and ATEX zone classification.', 'published', 'interactive', 35, 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74', true, 80, 'advanced', 150);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'DSEAR Fundamentals', 'Understanding dangerous substances regulations', 1),
  (m2, c_id, 'Risk Assessment & Zones', 'ATEX classification and risk assessment', 2),
  (m3, c_id, 'Control Measures & Emergency Response', 'Practical safety measures and incident response', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'What is DSEAR', '[{"type":"heading","content":"Dangerous Substances and Explosive Atmospheres Regulations 2002"},{"type":"paragraph","content":"DSEAR requires employers to control risks from dangerous substances that could cause fires, explosions, or similar energy-releasing events."},{"type":"bullets","content":["Applies to any workplace where dangerous substances are present","Covers petrol, LPG, solvents, dusts, and gases","Requires risk assessment and elimination or control of risks","Links with ATEX Directive for equipment in explosive atmospheres"]},{"type":"highlight","content":"Petrol forecourts are classified as DSEAR workplaces and require specific zone designations and controls."}]', 1, 6),
  (m1, 'Dangerous Substance Properties', '[{"type":"heading","content":"Understanding Dangerous Substances"},{"type":"bullets","content":["Flash point: temperature at which vapours ignite","Auto-ignition temperature: spontaneous ignition point","Explosive limits: LEL and UEL concentration ranges","Vapour density: heavier-than-air vapours accumulate at low levels","Static electricity as an ignition source"]},{"type":"note","content":"Petrol has a flash point of -43C, meaning it produces ignitable vapours at virtually any ambient temperature."}]', 2, 6),
  (m2, 'ATEX Zone Classification', '[{"type":"heading","content":"Hazardous Area Classification"},{"type":"paragraph","content":"Workplaces are classified into zones based on the likelihood of an explosive atmosphere being present."},{"type":"bullets","content":["Zone 0: Explosive atmosphere present continuously","Zone 1: Explosive atmosphere likely during normal operations","Zone 2: Explosive atmosphere unlikely but possible","Zone 20/21/22: Equivalent zones for combustible dusts"]},{"type":"highlight","content":"Only ATEX-rated equipment may be used within classified zones. Standard equipment can be an ignition source."}]', 1, 6),
  (m2, 'DSEAR Risk Assessment', '[{"type":"heading","content":"Conducting a DSEAR Assessment"},{"type":"bullets","content":["Identify all dangerous substances present","Evaluate risks from normal operations and foreseeable incidents","Classify hazardous areas into ATEX zones","Identify potential ignition sources","Assess who may be harmed and how","Determine appropriate control measures","Review and update regularly"]}]', 2, 6),
  (m3, 'Forecourt Safety Procedures', '[{"type":"heading","content":"Petrol Station Specific Controls"},{"type":"bullets","content":["No smoking anywhere on the forecourt","Mobile phones must not be used near pumps","Engines must be switched off during refuelling","No naked flames or spark-producing equipment","Spillage must be dealt with immediately using absorbent","Vapour recovery systems must be operational","Emergency shut-off button locations must be known by all staff"]},{"type":"highlight","content":"All staff must know the location and operation of the emergency shut-off system."}]', 1, 5),
  (m3, 'Emergency Response Procedures', '[{"type":"heading","content":"Responding to DSEAR Incidents"},{"type":"paragraph","content":"Rapid and correct response to incidents involving dangerous substances can prevent catastrophic outcomes."},{"type":"bullets","content":["Activate emergency stop systems immediately","Evacuate the area and establish exclusion zones","Call emergency services (fire brigade)","Do NOT attempt to fight large fires","Account for all staff and customers","Provide emergency services with substance information","Preserve evidence and complete incident reports"]}]', 2, 5);
END $$;

-- Course 39: Whistleblowing & Ethical Reporting
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Whistleblowing & Ethical Reporting', 'Training on the Public Interest Disclosure Act 1998, covering protected disclosures, reporting channels, and protections for whistleblowers.', 'published', 'classic', 30, '08bda676-2af9-4f15-89e2-6f3db75881dc', true, 80, 'intermediate', 130);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Understanding Whistleblowing', 'Legal framework and definitions', 1),
  (m2, c_id, 'Making a Disclosure', 'How to raise concerns properly', 2),
  (m3, c_id, 'Protections & Support', 'Legal protections and available support', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'What is Whistleblowing', '[{"type":"heading","content":"Protected Disclosures Under PIDA 1998"},{"type":"paragraph","content":"Whistleblowing is the disclosure of information that a worker reasonably believes shows wrongdoing within their organisation."},{"type":"bullets","content":["Criminal offences (fraud, theft, corruption)","Failure to comply with legal obligations","Miscarriages of justice","Danger to health and safety","Environmental damage","Deliberate concealment of any of the above"]},{"type":"highlight","content":"Whistleblowing is NOT the same as making a complaint about your own employment terms. It must be in the public interest."}]', 1, 5),
  (m1, 'Whistleblowing vs Grievance', '[{"type":"heading","content":"Understanding the Difference"},{"type":"paragraph","content":"It is important to distinguish between a whistleblowing disclosure and a workplace grievance."},{"type":"bullets","content":["Whistleblowing: concerns about wrongdoing affecting others or the public","Grievance: personal complaints about employment terms or treatment","Whistleblowing has specific legal protections under PIDA","Grievances are handled through the company grievance procedure","Some concerns may have elements of both"]},{"type":"note","content":"If in doubt about which route to use, seek advice from your trade union, ACAS, or an independent advisor."}]', 2, 5),
  (m2, 'Internal Reporting Channels', '[{"type":"heading","content":"Raising Concerns Internally"},{"type":"paragraph","content":"Most organisations encourage concerns to be raised internally first."},{"type":"bullets","content":["Line manager (unless they are implicated)","Senior management or director","Dedicated whistleblowing hotline or email","Compliance or ethics officer","Trade union representative","Non-executive director or board member"]},{"type":"highlight","content":"Keep a written record of your disclosure including dates, who you spoke to, and what was said."}]', 1, 5),
  (m2, 'External Reporting', '[{"type":"heading","content":"Prescribed Persons and Bodies"},{"type":"paragraph","content":"If internal reporting is not appropriate or has not been effective, disclosures can be made to prescribed persons."},{"type":"bullets","content":["HSE for health and safety concerns","Environmental Agency for environmental issues","FCA for financial services misconduct","HMRC for tax fraud","CQC for health and social care","Information Commissioner for data protection breaches","Police for criminal activity"]}]', 2, 5),
  (m3, 'Legal Protections', '[{"type":"heading","content":"Protection Against Detriment"},{"type":"paragraph","content":"Workers who make protected disclosures are protected from unfair treatment."},{"type":"bullets","content":["Protection from dismissal (automatically unfair if for whistleblowing)","Protection from demotion or denial of promotion","Protection from harassment or victimisation","No qualifying service period required to claim","Uncapped compensation at Employment Tribunal","Interim relief available pending tribunal hearing"]},{"type":"highlight","content":"It is illegal for an employer to dismiss or subject a worker to any detriment for making a protected disclosure."}]', 1, 5),
  (m3, 'Organisational Responsibilities', '[{"type":"heading","content":"Creating a Speak-Up Culture"},{"type":"paragraph","content":"Organisations have a responsibility to create an environment where staff feel safe to raise concerns."},{"type":"bullets","content":["Implement a clear whistleblowing policy","Train all staff on reporting procedures","Investigate all disclosures promptly and thoroughly","Provide feedback to the whistleblower where possible","Protect confidentiality throughout the process","Take action against anyone who victimises a whistleblower","Review and learn from disclosures to prevent recurrence"]}]', 2, 5);
END $$;

-- Course 40: Sustainability & Carbon Reduction
DO $$
DECLARE c_id uuid; m1 uuid; m2 uuid; m3 uuid;
BEGIN
  c_id := gen_random_uuid(); m1 := gen_random_uuid(); m2 := gen_random_uuid(); m3 := gen_random_uuid();
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (c_id, 'CPD: Sustainability & Carbon Reduction', 'Training on corporate sustainability responsibilities, carbon footprint reduction strategies, and the UK Net Zero commitment for businesses.', 'published', 'visual', 30, 'f82e7b7c-0f01-474b-a26d-e70d193a2bc2', true, 80, 'intermediate', 130);

  INSERT INTO course_modules (id, course_id, title, description, sort_order) VALUES
  (m1, c_id, 'Understanding Carbon Footprint', 'What carbon emissions mean for businesses', 1),
  (m2, c_id, 'Workplace Reduction Strategies', 'Practical steps to reduce emissions at work', 2),
  (m3, c_id, 'Reporting & Compliance', 'UK sustainability reporting requirements', 3);

  INSERT INTO course_lessons (module_id, title, content, sort_order, estimated_duration_minutes) VALUES
  (m1, 'Climate Change & Business', '[{"type":"heading","content":"The Business Case for Sustainability"},{"type":"paragraph","content":"The UK has committed to achieving Net Zero greenhouse gas emissions by 2050 under the Climate Change Act 2008."},{"type":"bullets","content":["Scope 1: Direct emissions from owned operations","Scope 2: Indirect emissions from purchased energy","Scope 3: All other indirect emissions (supply chain)","UK businesses account for approximately 18% of national emissions","Consumer demand for sustainable businesses is growing rapidly"]},{"type":"highlight","content":"The Environment Act 2021 gives the UK government new powers to set legally binding environmental targets."}]', 1, 5),
  (m1, 'Measuring Your Impact', '[{"type":"heading","content":"Carbon Footprint Calculation"},{"type":"paragraph","content":"Understanding your carbon footprint is the first step towards reducing it."},{"type":"bullets","content":["Energy consumption (gas, electricity, fuel)","Business travel and commuting","Waste generation and disposal methods","Water consumption","Supply chain emissions","Refrigerant gases and cooling systems"]},{"type":"note","content":"Carbon emissions are measured in tonnes of CO2 equivalent (tCO2e), which accounts for the global warming potential of different greenhouse gases."}]', 2, 5),
  (m2, 'Energy Efficiency', '[{"type":"heading","content":"Reducing Energy Consumption"},{"type":"bullets","content":["Switch to LED lighting throughout premises","Install motion sensors for non-essential lighting","Maintain HVAC systems for optimal efficiency","Use smart thermostats and building management systems","Procure 100% renewable electricity tariffs","Insulate buildings to reduce heat loss","Turn off equipment when not in use"]},{"type":"highlight","content":"Switching to LED lighting alone can reduce lighting energy costs by up to 80%."}]', 1, 5),
  (m2, 'Waste Reduction & Circular Economy', '[{"type":"heading","content":"Minimising Waste Impact"},{"type":"paragraph","content":"The waste hierarchy prioritises prevention over recycling, and recycling over disposal."},{"type":"bullets","content":["Prevent: reduce packaging and single-use items","Reuse: implement reuse schemes for containers and bags","Recycle: separate waste streams for maximum recycling","Recover: use waste-to-energy where recycling is not possible","Dispose: landfill as an absolute last resort"]},{"type":"note","content":"From 2025, businesses in England must separate recyclable waste under the Environment Act 2021 provisions."}]', 2, 5),
  (m3, 'SECR & ESOS Reporting', '[{"type":"heading","content":"UK Sustainability Reporting"},{"type":"paragraph","content":"Certain UK businesses must report on their energy consumption and carbon emissions."},{"type":"bullets","content":["SECR: Streamlined Energy and Carbon Reporting for quoted companies and large organisations","ESOS: Energy Savings Opportunity Scheme for large enterprises","TCFD: Task Force on Climate-related Financial Disclosures","Science Based Targets initiative (SBTi) for voluntary commitments","Environmental, Social, and Governance (ESG) reporting frameworks"]}]', 1, 5),
  (m3, 'Individual Actions That Matter', '[{"type":"heading","content":"What Every Employee Can Do"},{"type":"paragraph","content":"Sustainability is a collective effort. Individual actions across an organisation create significant impact."},{"type":"bullets","content":["Switch off lights, screens, and equipment when leaving","Use video calls instead of business travel where possible","Print only when absolutely necessary, use double-sided","Recycle correctly using designated waste streams","Report energy waste (dripping taps, faulty heating)","Support sustainable procurement choices","Share ideas for further improvements with management"]},{"type":"highlight","content":"If every UK worker saved just one sheet of paper per day, it would save over 100,000 trees annually."}]', 2, 5);
END $$;
