
DO $$
DECLARE
  cat_hs_id uuid;
  cat_wb_id uuid;
  cat_lc_id uuid;
  cat_env_id uuid;
  c_id uuid;
  m_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM course_categories WHERE name = 'Wellbeing') THEN
    INSERT INTO course_categories (id, name, description, color) VALUES (gen_random_uuid(), 'Wellbeing', 'Employee wellbeing and mental health', '#8B5CF6');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM course_categories WHERE name = 'Legal Compliance') THEN
    INSERT INTO course_categories (id, name, description, color) VALUES (gen_random_uuid(), 'Legal Compliance', 'Legal and regulatory compliance', '#0EA5E9');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM course_categories WHERE name = 'Environmental') THEN
    INSERT INTO course_categories (id, name, description, color) VALUES (gen_random_uuid(), 'Environmental', 'Environmental awareness and sustainability', '#10B981');
  END IF;

  SELECT id INTO cat_hs_id FROM course_categories WHERE name = 'Health & Safety' LIMIT 1;
  SELECT id INTO cat_wb_id FROM course_categories WHERE name = 'Wellbeing' LIMIT 1;
  SELECT id INTO cat_lc_id FROM course_categories WHERE name = 'Legal Compliance' LIMIT 1;
  SELECT id INTO cat_env_id FROM course_categories WHERE name = 'Environmental' LIMIT 1;

  -- 1. Workplace Stress Management (35 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Workplace Stress Management', 'Identify, manage and prevent workplace stress. Covers HSE Management Standards, resilience techniques and employer obligations under the Health and Safety at Work Act 1974.', 'published', 'interactive', 35, cat_wb_id, true, 80, 'intermediate', 140)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Understanding Workplace Stress', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'What is Workplace Stress?', 1, 4, '[{"type":"heading","content":"Defining Workplace Stress"},{"type":"paragraph","content":"The HSE defines work-related stress as the adverse reaction people have to excessive pressures or demands placed on them at work."},{"type":"highlight","content":"In 2023/24, stress, depression and anxiety accounted for 49% of all work-related ill health cases in Great Britain."},{"type":"bullet_points","content":["Stress is a natural response to perceived threats","It becomes harmful when sustained over time","Affects concentration, decision-making and relationships","Employers have a legal duty to assess and manage stress risks"]}]'),
    (m_id, 'The Stress Response Cycle', 2, 4, '[{"type":"heading","content":"Fight, Flight or Freeze"},{"type":"paragraph","content":"When we perceive a threat, adrenaline and cortisol are released. This survival mechanism can become chronically activated in modern workplaces."},{"type":"bullet_points","content":["Acute stress: short-term, can improve performance","Chronic stress: long-term, damages health","Physical symptoms: headaches, fatigue, muscle tension","Psychological symptoms: irritability, poor concentration, withdrawal"]}]'),
    (m_id, 'The Six HSE Management Standards', 3, 4, '[{"type":"heading","content":"Key Areas of Work Design"},{"type":"bullet_points","content":["Demands: workload, work patterns and environment","Control: how much say people have in their work","Support: encouragement and resources","Relationships: positive working and conflict handling","Role: understanding and avoiding conflicting roles","Change: how organisational change is managed"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Managing and Preventing Stress', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Personal Resilience Techniques', 1, 5, '[{"type":"heading","content":"Building Your Resilience Toolkit"},{"type":"bullet_points","content":["Time management using the Eisenhower Matrix","Boundary setting: learn to say no professionally","Mindfulness: 5 minutes of breathing reduces cortisol","Physical activity: proven stress reliever","Social connection at work","Consistent sleep patterns"]}]'),
    (m_id, 'Employer Legal Obligations', 2, 5, '[{"type":"heading","content":"Legal Framework"},{"type":"paragraph","content":"Under the Health and Safety at Work Act 1974 and Management Regulations 1999, employers must assess and manage risks from work-related stress."},{"type":"bullet_points","content":["Conduct stress risk assessments regularly","Train managers to recognise stress","Implement return-to-work procedures","Monitor working hours and workload","Ensure access to confidential support"]}]'),
    (m_id, 'Creating a Stress-Aware Culture', 3, 5, '[{"type":"heading","content":"From Reactive to Proactive"},{"type":"bullet_points","content":["Regular wellbeing check-ins","Anonymous stress surveys","Mental Health First Aiders","Clear escalation procedures","Celebrate work-life balance"]}]');

  -- 2. Equality, Diversity & Inclusion (40 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Equality, Diversity & Inclusion', 'Training on the Equality Act 2010, protected characteristics, unconscious bias and creating an inclusive workplace.', 'published', 'classic', 40, cat_lc_id, true, 80, 'intermediate', 160)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'The Legal Framework', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'The Equality Act 2010', 1, 5, '[{"type":"heading","content":"Understanding the Equality Act"},{"type":"paragraph","content":"Consolidated over 100 separate pieces of legislation into a single Act."},{"type":"bullet_points","content":["Covers direct and indirect discrimination, harassment, victimisation","Employers can be vicariously liable","Applies to employers, service providers and public bodies"]}]'),
    (m_id, 'Protected Characteristics', 2, 5, '[{"type":"heading","content":"The Nine Protected Characteristics"},{"type":"bullet_points","content":["Age","Disability","Gender reassignment","Marriage and civil partnership","Pregnancy and maternity","Race","Religion or belief","Sex","Sexual orientation"]},{"type":"highlight","content":"Discrimination by association and perception are also unlawful."}]'),
    (m_id, 'Types of Discrimination', 3, 5, '[{"type":"heading","content":"Recognising Discrimination"},{"type":"bullet_points","content":["Direct discrimination: less favourable treatment","Indirect discrimination: disadvantageous policies","Harassment: unwanted conduct creating hostile environment","Victimisation: unfair treatment for raising complaints"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Unconscious Bias & Inclusion', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Understanding Unconscious Bias', 1, 5, '[{"type":"heading","content":"What is Unconscious Bias?"},{"type":"bullet_points","content":["Affinity bias: favouring similar people","Confirmation bias: seeking confirming information","Halo effect: one trait influences overall judgement","Attribution bias: different success/failure attributions"]}]'),
    (m_id, 'Building an Inclusive Workplace', 2, 5, '[{"type":"heading","content":"From Diversity to Inclusion"},{"type":"bullet_points","content":["Use inclusive language","Ensure all voices are heard in meetings","Review recruitment for bias","Create employee resource groups","Provide reasonable adjustments proactively"]}]'),
    (m_id, 'Handling Complaints', 3, 5, '[{"type":"heading","content":"Your Responsibilities"},{"type":"bullet_points","content":["Challenge inappropriate behaviour when safe","Report incidents to line manager or HR","Use formal grievance procedure if needed","Support colleagues who raise concerns","Document incidents with dates and witnesses"]},{"type":"highlight","content":"Retaliation against someone raising a discrimination complaint is unlawful victimisation."}]');

  -- 3. Data Protection & GDPR (35 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Data Protection & GDPR', 'Master UK GDPR and Data Protection Act 2018 principles. Covers lawful bases, data subject rights, breach reporting and daily responsibilities.', 'published', 'step_by_step', 35, cat_lc_id, true, 80, 'intermediate', 140)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'GDPR Principles', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'The Seven Principles', 1, 5, '[{"type":"heading","content":"UK GDPR Key Principles"},{"type":"bullet_points","content":["Lawfulness, fairness and transparency","Purpose limitation","Data minimisation","Accuracy","Storage limitation","Integrity and confidentiality","Accountability"]},{"type":"highlight","content":"The accountability principle requires organisations to demonstrate compliance, not just comply."}]'),
    (m_id, 'Lawful Bases for Processing', 2, 5, '[{"type":"heading","content":"Six Lawful Bases"},{"type":"bullet_points","content":["Consent","Contract","Legal obligation","Vital interests","Public task","Legitimate interests"]}]'),
    (m_id, 'Types of Personal Data', 3, 4, '[{"type":"heading","content":"Personal vs Special Category Data"},{"type":"bullet_points","content":["Personal data: name, email, employee number, IP address","Special category: health, ethnicity, religion, biometrics","Criminal conviction data: additional safeguards required"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Rights, Breaches & Compliance', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Data Subject Rights', 1, 5, '[{"type":"heading","content":"Eight Individual Rights"},{"type":"bullet_points","content":["Right to be informed","Right of access (SARs within one month)","Right to rectification","Right to erasure","Right to restrict processing","Right to data portability","Right to object","Rights re automated decision-making"]}]'),
    (m_id, 'Data Breach Management', 2, 5, '[{"type":"heading","content":"When Things Go Wrong"},{"type":"bullet_points","content":["Report breaches to DPO immediately","Notify ICO within 72 hours if notifiable","Communicate high-risk breaches to individuals","Fines up to 17.5 million GBP or 4% global turnover"]},{"type":"highlight","content":"Common breaches: emails to wrong recipients, lost devices, ransomware, verbal disclosure."}]'),
    (m_id, 'Daily Responsibilities', 3, 4, '[{"type":"heading","content":"Practical Data Protection"},{"type":"bullet_points","content":["Lock your screen when leaving your desk","Never share passwords","Use encrypted email for sensitive data","Clear desk policy","Verify caller identity before sharing info","Use confidential waste bins","Report suspected breaches immediately"]}]');

  -- 4. Slips, Trips & Falls Prevention (30 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Slips, Trips & Falls Prevention', 'The most common cause of UK workplace injuries. Learn to identify hazards, implement controls and create safer environments.', 'published', 'visual', 30, cat_hs_id, true, 80, 'beginner', 120)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Understanding the Risks', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'The Scale of the Problem', 1, 5, '[{"type":"heading","content":"Why Slips, Trips and Falls Matter"},{"type":"highlight","content":"Slips, trips and falls cause 30% of all reported injuries and over 7 million lost working days annually."},{"type":"bullet_points","content":["Most common in retail, catering and healthcare","Can result in fractures, head injuries, back injuries","Average cost per incident: 1,000 to 10,000 GBP","95% are preventable"]}]'),
    (m_id, 'Common Causes', 2, 5, '[{"type":"heading","content":"Identifying Hazards"},{"type":"bullet_points","content":["Wet or contaminated floors","Uneven surfaces and loose tiles","Poor lighting in walkways","Trailing cables","Unsuitable footwear","Obstructed walkways","Ice, snow, wet leaves externally"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Prevention and Control', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Floor Surface Management', 1, 5, '[{"type":"heading","content":"Keeping Surfaces Safe"},{"type":"bullet_points","content":["Clean spills immediately","Use wet floor signs","Choose correct cleaning products","Ensure drainage is clear","Replace damaged floor coverings","Consider anti-slip treatments"]}]'),
    (m_id, 'Housekeeping Best Practices', 2, 5, '[{"type":"heading","content":"Good Housekeeping"},{"type":"bullet_points","content":["Maintain clear walkways","Store materials safely","Manage cables with covers","Remove waste regularly","Ensure adequate lighting","Report defects immediately","Conduct regular inspections"]}]'),
    (m_id, 'Risk Assessment', 3, 5, '[{"type":"heading","content":"Systematic Assessment"},{"type":"paragraph","content":"Required under the Management of Health and Safety at Work Regulations 1999."},{"type":"bullet_points","content":["Identify incident areas","Assess floor condition","Consider footwear requirements","Review cleaning schedules","Check lighting levels","Assess external areas","Record findings and implement controls"]}]');

  -- 5. Conflict Resolution & De-escalation (35 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Conflict Resolution & De-escalation', 'Handle difficult situations, manage aggressive behaviour, and resolve workplace conflicts professionally with verbal and non-verbal techniques.', 'published', 'interactive', 35, cat_wb_id, true, 80, 'advanced', 140)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Understanding Conflict', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Types of Workplace Conflict', 1, 4, '[{"type":"heading","content":"Recognising Conflict"},{"type":"bullet_points","content":["Task conflict: disagreements about work content","Process conflict: disputes about methods","Relationship conflict: personal tensions","Customer conflict: service disagreements","Status conflict: authority disputes"]}]'),
    (m_id, 'The Escalation Cycle', 2, 4, '[{"type":"heading","content":"How Situations Escalate"},{"type":"bullet_points","content":["Stage 1 - Trigger: event sparks frustration","Stage 2 - Escalation: raised voices, aggression","Stage 3 - Crisis: peak arousal, reduced reasoning","Stage 4 - Recovery: calming begins","Stage 5 - Post-crisis: reflection"]},{"type":"highlight","content":"Effective de-escalation works in Stages 1 and 2. At Stage 3, prioritise safety."}]'),
    (m_id, 'Warning Signs', 3, 4, '[{"type":"heading","content":"Early Warning Signs"},{"type":"bullet_points","content":["Verbal: raised voice, swearing, threats","Facial: fixed stare, flushed face, clenched jaw","Body: space invasion, finger pointing, clenched fists","Behavioural: pacing, refusing to sit, throwing objects"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'De-escalation Techniques', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Verbal De-escalation', 1, 5, '[{"type":"heading","content":"What to Say"},{"type":"bullet_points","content":["Use calm, steady tone","Acknowledge their feelings","Use their name if known","Offer choices not ultimatums","Avoid trigger words","Ask open questions","Summarise to show listening"]}]'),
    (m_id, 'Non-verbal Communication', 2, 5, '[{"type":"heading","content":"Body Language"},{"type":"paragraph","content":"55% of communication is body language, 38% tone, only 7% words."},{"type":"bullet_points","content":["Open, non-threatening posture","Safe distance of arms length","Slight angle positioning","Visible, relaxed hands","Appropriate eye contact","Avoid crossed arms","Ensure clear exit route"]}]'),
    (m_id, 'After the Incident', 3, 5, '[{"type":"heading","content":"Post-Incident Steps"},{"type":"bullet_points","content":["Complete incident report promptly","Seek manager support","Access employee assistance","Participate in debriefs","Identify improvements"]}]');

  -- 6. Lone Working Safety (30 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Lone Working Safety', 'Essential guidance for employees working alone. Covers risk assessment, communication protocols, personal safety and legal duties.', 'published', 'step_by_step', 30, cat_hs_id, true, 80, 'intermediate', 120)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Lone Working Fundamentals', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Who is a Lone Worker?', 1, 5, '[{"type":"heading","content":"Defining Lone Working"},{"type":"bullet_points","content":["Shop workers during quiet periods","Delivery drivers and mobile workers","Night shift workers","Home and remote workers","Maintenance staff in isolated areas","Cleaners outside normal hours"]},{"type":"highlight","content":"No general legal prohibition on working alone, but HSWA 1974 duties still apply."}]'),
    (m_id, 'Risk Assessment', 2, 5, '[{"type":"heading","content":"Assessing Lone Worker Risks"},{"type":"bullet_points","content":["Can the workplace be made safe for one person?","Can equipment be safely handled alone?","Is the worker medically fit?","What training is needed?","How will they summon help?","Is there a violence risk?","Are some tasks two-person only?"]}]'),
    (m_id, 'Legal Requirements', 3, 5, '[{"type":"heading","content":"Employer Duties"},{"type":"bullet_points","content":["HSWA 1974: general duty of care","Management Regulations 1999: risk assessment","RIDDOR 2013: reporting","Corporate Manslaughter Act 2007","Working Time Regulations 1998"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Staying Safe Alone', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Communication Protocols', 1, 5, '[{"type":"heading","content":"Keeping in Touch"},{"type":"bullet_points","content":["Regular check-in calls","Buddy systems","Personal safety devices and apps","GPS tracking with consent","Missed check-in procedures","Emergency contacts available"]}]'),
    (m_id, 'Personal Safety Measures', 2, 5, '[{"type":"heading","content":"Protecting Yourself"},{"type":"bullet_points","content":["Plan work and share schedule","Keep phone charged","Know emergency procedures","Trust your instincts","Keep valuables hidden","Park in well-lit areas","Report concerns promptly"]},{"type":"note","content":"You can refuse work posing serious danger under Section 44 Employment Rights Act 1996."}]');

  -- 7. Environmental Awareness & Waste Management (30 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Environmental Awareness & Waste Management', 'Environmental responsibilities, waste hierarchy, and reducing workplace impact. Covers the Environmental Protection Act 1990.', 'published', 'visual', 30, cat_env_id, true, 80, 'beginner', 120)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Environmental Responsibilities', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Why It Matters', 1, 5, '[{"type":"heading","content":"Business Case for Environmental Action"},{"type":"bullet_points","content":["UK businesses produce 41 million tonnes of waste annually","Rising energy costs make efficiency critical","Customers choose responsible businesses","Environment Act 2021 sets binding targets","Non-compliance risks unlimited fines"]},{"type":"highlight","content":"The UK committed to net zero by 2050 under the Climate Change Act 2008."}]'),
    (m_id, 'The Waste Hierarchy', 2, 5, '[{"type":"heading","content":"Reduce, Reuse, Recycle"},{"type":"bullet_points","content":["Prevention: avoid creating waste","Preparing for re-use: repair and refurbish","Recycling: process into new products","Recovery: energy recovery","Disposal: landfill as last resort"]}]'),
    (m_id, 'Duty of Care', 3, 5, '[{"type":"heading","content":"Legal Obligations"},{"type":"paragraph","content":"Under the Environmental Protection Act 1990, waste producers have a duty of care."},{"type":"bullet_points","content":["Store waste safely","Transfer only to authorised persons","Complete waste transfer notes","Complete hazardous waste consignment notes","Keep records minimum 2 years","Describe waste accurately"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Practical Actions', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Reducing Energy and Water', 1, 5, '[{"type":"heading","content":"Everyday Actions"},{"type":"bullet_points","content":["Switch off lights in empty areas","Turn off equipment fully, not standby","Report dripping taps","Use natural ventilation","Set appropriate temperatures","Use energy-efficient settings","Report insulation issues"]}]'),
    (m_id, 'Waste Segregation', 2, 5, '[{"type":"heading","content":"Getting Recycling Right"},{"type":"bullet_points","content":["General waste: non-recyclable items","Mixed recycling: paper, card, plastics, cans","Glass: separated by colour","Food waste: composting collection","Hazardous: batteries, chemicals, tubes","WEEE: electrical equipment","Confidential: sensitive documents"]},{"type":"highlight","content":"Contamination can cause entire recycling loads to go to landfill."}]');

  -- 8. Anti-Money Laundering Awareness (30 min)
  INSERT INTO courses (id, title, description, status, template_style, estimated_duration_minutes, category_id, certificate_enabled, passing_score, difficulty_level, xp_reward)
  VALUES (gen_random_uuid(), 'CPD: Anti-Money Laundering Awareness', 'Recognise money laundering risks in retail, identify suspicious transactions, and understand reporting obligations under POCA 2002.', 'published', 'classic', 30, cat_lc_id, true, 80, 'advanced', 120)
  RETURNING id INTO c_id;
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Understanding Money Laundering', 1) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'What is Money Laundering?', 1, 5, '[{"type":"heading","content":"The Three Stages"},{"type":"paragraph","content":"Making illegally obtained money appear legitimate. Carries up to 14 years imprisonment."},{"type":"bullet_points","content":["Placement: introducing criminal cash","Layering: complex transactions to disguise origin","Integration: cleaned money re-enters economy"]},{"type":"highlight","content":"The NCA estimates money laundering costs the UK over 100 billion GBP per year."}]'),
    (m_id, 'UK AML Legislation', 2, 5, '[{"type":"heading","content":"Legal Framework"},{"type":"bullet_points","content":["Proceeds of Crime Act 2002","Terrorism Act 2000","Money Laundering Regulations 2017","Criminal Finances Act 2017","Sanctions and AML Act 2018"]},{"type":"note","content":"Failure to report a suspicion is itself a criminal offence."}]'),
    (m_id, 'Money Laundering in Retail', 3, 5, '[{"type":"heading","content":"How It Affects Your Workplace"},{"type":"bullet_points","content":["Large cash purchases of high-value goods","Buy then return for different payment method","Multiple transactions below thresholds","Customers unconcerned about price","Unusual bulk gift card purchases","Frequent returns without receipts","Reluctance to provide identification"]}]');
  INSERT INTO course_modules (id, course_id, title, sort_order) VALUES (gen_random_uuid(), c_id, 'Reporting Obligations', 2) RETURNING id INTO m_id;
  INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
    (m_id, 'Recognising Red Flags', 1, 5, '[{"type":"heading","content":"Warning Signs"},{"type":"bullet_points","content":["Unusual customer behaviour","Transactions lacking commercial sense","Reluctance to provide ID","Requests to split transactions","Overpayment with refund requests","Multiple payment methods","Nervous customers directed by others"]}]'),
    (m_id, 'How to Report', 2, 5, '[{"type":"heading","content":"The Reporting Process"},{"type":"bullet_points","content":["Report to your MLRO","MLRO assesses and may submit SAR to NCA","Do NOT inform the customer","Do NOT discuss outside reporting chain","Continue transaction normally unless told otherwise","Record what made you suspicious"]},{"type":"highlight","content":"Tipping off is a criminal offence under POCA Section 333A: up to 5 years imprisonment."}]');

END $$;
