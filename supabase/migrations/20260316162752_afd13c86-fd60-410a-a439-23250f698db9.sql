
-- 8 new CPD courses with modules and lessons

DO $$
DECLARE
  cat_hs uuid := 'd5b7031f-f1ec-4472-b28b-9b98e01a6b74';
  cat_legal uuid := '08bda676-2af9-4f15-89e2-6f3db75881dc';
  cat_wellbeing uuid := 'ad2ed637-e890-4c99-ae42-83b55f7166e9';
  
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; c7 uuid; c8 uuid;
  m uuid;
BEGIN

-- =============================================
-- COURSE 1: Display Screen Equipment (DSE)
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Display Screen Equipment (DSE)', 'Learn to set up your workstation ergonomically, understand employer duties under the Health and Safety (Display Screen Equipment) Regulations 1992, and reduce the risk of musculoskeletal disorders.', 'interactive', 30, cat_hs, 'published', true, 'beginner', 120, 80)
RETURNING id INTO c1;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c1, 'DSE Legislation & Employer Duties', 'UK legal framework for DSE use', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The DSE Regulations 1992', 1, 5, '[{"type":"heading","content":"Health and Safety (Display Screen Equipment) Regulations 1992"},{"type":"paragraph","content":"These regulations require employers to assess DSE workstations, reduce risks, provide eye tests, and ensure adequate breaks for habitual users."},{"type":"highlight","content":"A habitual DSE user is someone who uses display screen equipment for continuous periods of an hour or more on most working days."},{"type":"bullet_points","content":["Workstation risk assessments are mandatory","Employers must provide eye tests on request","Regular breaks from DSE work must be planned","Training must be provided to all DSE users"]}]'),
(m, 'Employer and Employee Responsibilities', 2, 5, '[{"type":"heading","content":"Shared Responsibilities"},{"type":"paragraph","content":"Employers must provide suitable equipment and training. Employees must use equipment correctly and report any discomfort promptly."},{"type":"note","content":"Failure to report early symptoms can lead to chronic conditions that are far harder to treat."},{"type":"bullet_points","content":["Employers: risk assessment, equipment provision, training","Employees: correct use, reporting problems, following guidance","Both: maintaining a safe working environment"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c1, 'Ergonomic Workstation Setup', 'Setting up your desk, chair, and screen correctly', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Chair and Desk Configuration', 1, 5, '[{"type":"heading","content":"Setting Up Your Chair and Desk"},{"type":"paragraph","content":"Your chair should support your lower back. Feet should be flat on the floor, thighs horizontal, and forearms level with the desk surface."},{"type":"bullet_points","content":["Adjust seat height so feet are flat on the floor","Backrest should support the lumbar curve","Armrests should allow shoulders to relax","Desk height should allow forearms to be horizontal"]}]'),
(m, 'Screen, Keyboard and Mouse Placement', 2, 5, '[{"type":"heading","content":"Positioning Your Equipment"},{"type":"paragraph","content":"The top of the screen should be at or slightly below eye level. The screen should be approximately an arm''s length away. Keyboard and mouse should be close to reduce reaching."},{"type":"highlight","content":"Position the screen to avoid glare from windows or overhead lighting. Use blinds or screen filters if necessary."},{"type":"bullet_points","content":["Screen top at eye level or slightly below","Monitor approximately arm''s length away","Keyboard directly in front with space to rest wrists","Mouse close to keyboard at the same height"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c1, 'Health Risks and Prevention', 'Common DSE-related conditions and how to prevent them', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Musculoskeletal Disorders', 1, 5, '[{"type":"heading","content":"Understanding MSDs from DSE Use"},{"type":"paragraph","content":"Repetitive strain injury (RSI), carpal tunnel syndrome, and back pain are among the most common conditions caused by poor DSE practices."},{"type":"bullet_points","content":["RSI affects tendons, muscles and nerves","Carpal tunnel syndrome causes numbness in hands","Upper and lower back pain from poor posture","Neck and shoulder tension from screen positioning"]},{"type":"note","content":"Take regular micro-breaks: stand, stretch, and move every 20-30 minutes."}]'),
(m, 'Eye Strain and Fatigue', 2, 5, '[{"type":"heading","content":"Protecting Your Eyes"},{"type":"paragraph","content":"Prolonged screen use can cause eye strain, headaches, and blurred vision. The 20-20-20 rule is a proven technique to reduce symptoms."},{"type":"highlight","content":"20-20-20 Rule: Every 20 minutes, look at something 20 feet away for 20 seconds."},{"type":"bullet_points","content":["Adjust screen brightness to match surroundings","Increase text size if squinting","Blink frequently to prevent dry eyes","Request an eye test if symptoms persist"]}]');


-- =============================================
-- COURSE 2: Noise at Work
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Noise at Work', 'Understand noise exposure limits under the Control of Noise at Work Regulations 2005, identify hazardous noise levels, and learn effective hearing protection strategies.', 'step_by_step', 30, cat_hs, 'published', true, 'intermediate', 130, 80)
RETURNING id INTO c2;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c2, 'Noise Regulations and Standards', 'UK legal framework for noise exposure', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Control of Noise at Work Regulations 2005', 1, 5, '[{"type":"heading","content":"The Noise Regulations"},{"type":"paragraph","content":"These regulations set out the duties of employers to prevent or reduce risks to health from exposure to noise at work. They define specific action levels and exposure limits."},{"type":"bullet_points","content":["Lower Exposure Action Value: 80 dB(A) daily average","Upper Exposure Action Value: 85 dB(A) daily average","Exposure Limit Value: 87 dB(A) taking hearing protection into account","Peak sound pressure limit: 140 dB(C)"]},{"type":"highlight","content":"Normal conversation is approximately 60-65 dB. If you need to raise your voice to be heard at 2 metres, noise levels are likely above 85 dB."}]'),
(m, 'Risk Assessment for Noise', 2, 5, '[{"type":"heading","content":"Conducting a Noise Risk Assessment"},{"type":"paragraph","content":"Employers must assess noise levels using calibrated sound level meters and identify workers at risk. Records must be kept and reviewed regularly."},{"type":"bullet_points","content":["Identify noise sources and affected workers","Measure exposure using calibrated equipment","Record findings and action plans","Review when circumstances change"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c2, 'Hearing Damage and Protection', 'How noise damages hearing and protective measures', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'How Noise Damages Hearing', 1, 5, '[{"type":"heading","content":"Noise-Induced Hearing Loss"},{"type":"paragraph","content":"Prolonged exposure to loud noise destroys the tiny hair cells in the cochlea. This damage is permanent and irreversible. Tinnitus (ringing in the ears) is another common consequence."},{"type":"bullet_points","content":["Hair cells in the inner ear cannot regenerate","Damage accumulates over years of exposure","Tinnitus can be debilitating and permanent","Early symptoms include muffled hearing after work"]}]'),
(m, 'Hearing Protection Equipment', 2, 5, '[{"type":"heading","content":"Selecting and Using Hearing Protection"},{"type":"paragraph","content":"Hearing protection must be suitable for the noise level and environment. Options include ear plugs, ear muffs, and banded ear protectors."},{"type":"bullet_points","content":["Ear plugs: disposable or reusable, good for prolonged wear","Ear muffs: easy to fit, suitable for intermittent noise","Must achieve adequate attenuation for the noise level","Workers must be trained in correct fitting and use"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c2, 'Noise Control Strategies', 'Engineering and administrative controls', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Hierarchy of Noise Controls', 1, 5, '[{"type":"heading","content":"Reducing Noise at Source"},{"type":"paragraph","content":"The preferred approach is to eliminate or reduce noise at source before relying on personal protective equipment."},{"type":"bullet_points","content":["Elimination: remove the noisy process entirely","Substitution: use quieter equipment or methods","Engineering: enclose machinery, install barriers","Administrative: rotate workers, limit exposure time","PPE: hearing protection as last resort"]},{"type":"note","content":"PPE should always be the last resort, not the first response to noise hazards."}]'),
(m, 'Health Surveillance', 2, 5, '[{"type":"heading","content":"Monitoring Worker Health"},{"type":"paragraph","content":"Workers regularly exposed above the upper action value must receive health surveillance including audiometry (hearing tests) to detect early signs of damage."},{"type":"bullet_points","content":["Baseline audiometry before exposure begins","Regular follow-up tests (typically annual)","Results must be recorded and retained","Workers must be informed of their results"]}]');


-- =============================================
-- COURSE 3: Working at Height
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Working at Height Safety', 'Master the Work at Height Regulations 2005, learn to select appropriate access equipment, and understand fall prevention and rescue planning.', 'classic', 35, cat_hs, 'published', true, 'intermediate', 140, 80)
RETURNING id INTO c3;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c3, 'Work at Height Regulations', 'Legal duties and planning requirements', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The Work at Height Regulations 2005', 1, 5, '[{"type":"heading","content":"Work at Height Regulations 2005"},{"type":"paragraph","content":"Falls from height remain the single largest cause of workplace fatality in the UK. These regulations apply to all work at height where there is a risk of a fall that could cause personal injury."},{"type":"highlight","content":"Working at height means working in any place where a person could fall a distance liable to cause personal injury, including at or below ground level."},{"type":"bullet_points","content":["Avoid work at height where reasonably practicable","Use work equipment to prevent falls where height work cannot be avoided","Minimise the distance and consequences of any fall","All work at height must be properly planned and supervised"]}]'),
(m, 'Planning and Organising', 2, 5, '[{"type":"heading","content":"Planning Work at Height"},{"type":"paragraph","content":"Every task involving work at height must be planned by a competent person, appropriately supervised, and carried out in safe weather conditions."},{"type":"bullet_points","content":["Assess risks before starting any work at height","Ensure workers are competent and trained","Check weather conditions are suitable","Plan emergency rescue procedures in advance"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c3, 'Access Equipment Selection', 'Choosing the right equipment for the task', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Ladders, Stepladders and Platforms', 1, 5, '[{"type":"heading","content":"When to Use Ladders"},{"type":"paragraph","content":"Ladders should only be used for short-duration tasks (under 30 minutes) or where the risk assessment shows other equipment is not justified."},{"type":"bullet_points","content":["Ladder must be on a firm, level surface","Extend at least 1 metre above the landing point","Maintain 3 points of contact at all times","Never overreach from a ladder"]},{"type":"note","content":"A ladder is never a working platform. If extended work is needed, use scaffolding or a mobile elevated work platform (MEWP)."}]'),
(m, 'Scaffolding and MEWPs', 2, 6, '[{"type":"heading","content":"Scaffolding and Mobile Elevated Work Platforms"},{"type":"paragraph","content":"Scaffolding must be erected, altered, and dismantled by competent persons. MEWPs require operator training and pre-use checks."},{"type":"bullet_points","content":["Scaffolding must be inspected before first use","Re-inspection required every 7 days minimum","MEWP operators must hold appropriate training certificate","Daily pre-use checks are mandatory for all MEWPs"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c3, 'Fall Prevention and Rescue', 'Preventing falls and planning rescue', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Edge Protection and Safety Nets', 1, 5, '[{"type":"heading","content":"Collective Fall Prevention"},{"type":"paragraph","content":"Collective protection (guardrails, safety nets) must always be prioritised over personal protection (harnesses). It protects everyone without requiring individual action."},{"type":"bullet_points","content":["Guard rails must be at least 950mm high","Toe boards prevent tools and materials falling","Safety nets must be correctly installed and inspected","Collective measures protect all workers simultaneously"]}]'),
(m, 'Personal Fall Protection and Rescue Plans', 2, 4, '[{"type":"heading","content":"Harnesses, Lanyards and Rescue"},{"type":"paragraph","content":"Where collective protection is not practicable, personal fall protection systems must be used. A rescue plan must always be in place before work begins."},{"type":"bullet_points","content":["Harnesses must be correctly fitted and inspected","Lanyards must be appropriate for the fall distance","Rescue must be achievable within minutes, not hours","Suspension trauma can be fatal within 15-30 minutes"]},{"type":"highlight","content":"Never use a personal fall protection system without a pre-planned rescue procedure. Suspension in a harness after a fall can be life-threatening."}]');


-- =============================================
-- COURSE 4: Legionella Awareness
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Legionella Awareness', 'Understand the risks of Legionnaires'' disease, learn about water system management under the HSE Approved Code of Practice L8, and know how to prevent bacterial growth.', 'visual', 30, cat_hs, 'published', true, 'intermediate', 120, 80)
RETURNING id INTO c4;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c4, 'Understanding Legionella', 'The bacterium, the disease, and how infection occurs', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'What is Legionella?', 1, 5, '[{"type":"heading","content":"Legionella Bacteria and Legionnaires'' Disease"},{"type":"paragraph","content":"Legionella pneumophila is a bacterium found naturally in freshwater. It becomes dangerous when it multiplies in man-made water systems and is inhaled as fine droplets (aerosols)."},{"type":"bullet_points","content":["Legionnaires'' disease is a severe form of pneumonia","Fatality rate is approximately 10-15%","Infection occurs by inhaling contaminated water droplets","It cannot be spread person to person"]},{"type":"highlight","content":"Legionella thrives between 20-45 degrees Celsius. Below 20 it is dormant; above 60 it is killed."}]'),
(m, 'Who is at Risk?', 2, 5, '[{"type":"heading","content":"Vulnerable Groups and Risk Factors"},{"type":"paragraph","content":"Anyone can contract Legionnaires'' disease, but certain groups are at significantly higher risk."},{"type":"bullet_points","content":["People over 45 years of age","Smokers and heavy drinkers","Those with chronic respiratory conditions","Immunocompromised individuals","Males are three times more likely to be affected"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c4, 'Water System Management', 'Controlling risks in building water systems', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The ACOP L8 Requirements', 1, 5, '[{"type":"heading","content":"HSE Approved Code of Practice L8"},{"type":"paragraph","content":"ACOP L8 sets out the legal duties for managing legionella risks. It requires the appointment of a responsible person, risk assessments, and a written control scheme."},{"type":"bullet_points","content":["Appoint a competent responsible person","Conduct and review legionella risk assessments","Implement a written scheme of control","Keep records of inspections and maintenance"]}]'),
(m, 'Temperature and Flushing Controls', 2, 5, '[{"type":"heading","content":"Practical Control Measures"},{"type":"paragraph","content":"Temperature control is the primary defence against legionella. Cold water must be kept below 20 degrees and hot water stored above 60 degrees and distributed above 50 degrees."},{"type":"bullet_points","content":["Hot water stored at 60 degrees or above","Hot water distributed at 50 degrees minimum at outlets","Cold water kept below 20 degrees","Infrequently used outlets flushed weekly"]},{"type":"note","content":"Stagnant water is the greatest risk factor. Any tap, shower, or system unused for over a week must be flushed before use."}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c4, 'Monitoring and Record Keeping', 'Ongoing compliance and documentation', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Monitoring Regimes', 1, 5, '[{"type":"heading","content":"Regular Monitoring Requirements"},{"type":"paragraph","content":"Water temperatures, bacterial counts, and system conditions must be monitored on a regular schedule and records maintained for a minimum of 5 years."},{"type":"bullet_points","content":["Monthly temperature checks at sentinel outlets","Quarterly checks on calorifiers and storage vessels","Annual review of the entire risk assessment","Records retained for minimum 5 years"]}]'),
(m, 'Outbreak Response', 2, 5, '[{"type":"heading","content":"Responding to a Suspected Case"},{"type":"paragraph","content":"If Legionnaires'' disease is suspected, immediate action is required. The water system must be shut down, sampled, and disinfected. Public Health England must be notified."},{"type":"bullet_points","content":["Notify Public Health England immediately","Shut down and isolate the suspect water system","Arrange emergency sampling and testing","Implement emergency disinfection procedures","Cooperate fully with the HSE investigation"]}]');


-- =============================================
-- COURSE 5: Asbestos Awareness
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Asbestos Awareness', 'Recognise where asbestos may be found, understand the health risks of exposure, and learn the legal requirements under the Control of Asbestos Regulations 2012.', 'classic', 30, cat_hs, 'published', true, 'intermediate', 130, 80)
RETURNING id INTO c5;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c5, 'What is Asbestos?', 'Types, properties, and where it is found', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Types of Asbestos', 1, 5, '[{"type":"heading","content":"The Three Main Types of Asbestos"},{"type":"paragraph","content":"Asbestos is a naturally occurring fibrous mineral that was widely used in UK construction until its ban in 1999. Three main types exist, all of which are dangerous."},{"type":"bullet_points","content":["Chrysotile (white asbestos) - most commonly used, found in roofs, walls, floors","Amosite (brown asbestos) - used in insulation boards and ceiling tiles","Crocidolite (blue asbestos) - most hazardous, used in spray coatings"]},{"type":"highlight","content":"You cannot identify asbestos by looking at it. Any building constructed before 2000 may contain asbestos materials. Always assume materials contain asbestos until tested."}]'),
(m, 'Where Asbestos is Found', 2, 5, '[{"type":"heading","content":"Common Locations in Buildings"},{"type":"paragraph","content":"Asbestos was used in over 3,000 products. In buildings, it is commonly found in textured coatings, floor tiles, roof sheets, pipe insulation, and fire doors."},{"type":"bullet_points","content":["Textured decorative coatings (Artex)","Vinyl floor tiles and backing","Cement roof sheets and guttering","Pipe and boiler insulation lagging","Fire door cores and fire blankets"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c5, 'Health Risks and Regulations', 'Asbestos-related diseases and legal duties', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Asbestos-Related Diseases', 1, 5, '[{"type":"heading","content":"The Fatal Consequences of Asbestos Exposure"},{"type":"paragraph","content":"Asbestos fibres, when inhaled, embed in the lungs and cause fatal diseases that can take 15-60 years to develop. Over 5,000 people die from asbestos-related diseases each year in the UK."},{"type":"bullet_points","content":["Mesothelioma: cancer of the lung lining, always fatal","Asbestosis: scarring of lung tissue, progressive","Lung cancer: risk greatly increased with asbestos exposure","Pleural thickening: restricts lung expansion"]},{"type":"note","content":"There is no safe level of exposure to asbestos. A single significant exposure event can cause fatal disease decades later."}]'),
(m, 'Control of Asbestos Regulations 2012', 2, 5, '[{"type":"heading","content":"Legal Duties Under CAR 2012"},{"type":"paragraph","content":"The duty holder (building owner or manager) must manage asbestos by identifying its location, assessing its condition, and ensuring it is not disturbed."},{"type":"bullet_points","content":["Duty to manage asbestos in non-domestic premises","Asbestos surveys must be conducted","An asbestos register must be maintained","Anyone who may disturb asbestos must be informed"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c5, 'Safe Working Practices', 'What to do if you encounter asbestos', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'If You Suspect Asbestos', 1, 5, '[{"type":"heading","content":"Stop, Report, Protect"},{"type":"paragraph","content":"If you suspect you have found or disturbed asbestos-containing material, stop work immediately, prevent others from entering the area, and report to your supervisor."},{"type":"bullet_points","content":["STOP all work in the area immediately","Do NOT attempt to clean up any debris","Prevent others from entering the area","Report to your supervisor or duty holder","Wash hands and any exposed skin"]},{"type":"highlight","content":"Only licensed contractors can remove asbestos. Never attempt to handle, move, or dispose of suspected asbestos materials yourself."}]'),
(m, 'Emergency Procedures', 2, 5, '[{"type":"heading","content":"Responding to Accidental Disturbance"},{"type":"paragraph","content":"If asbestos is accidentally disturbed, the area must be evacuated, sealed off, and a specialist contractor called. All potentially exposed individuals must be recorded."},{"type":"bullet_points","content":["Evacuate and seal the affected area","Record names of all potentially exposed persons","Contact a licensed asbestos removal contractor","Notify the HSE if exposure has occurred","Affected individuals should seek medical advice"]}]');


-- =============================================
-- COURSE 6: Modern Slavery Awareness
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Modern Slavery Awareness', 'Recognise the signs of modern slavery and human trafficking, understand your legal duties under the Modern Slavery Act 2015, and learn how to report concerns effectively.', 'interactive', 35, cat_legal, 'published', true, 'intermediate', 140, 80)
RETURNING id INTO c6;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c6, 'Understanding Modern Slavery', 'Forms, scale, and legal definitions', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'What is Modern Slavery?', 1, 5, '[{"type":"heading","content":"Defining Modern Slavery"},{"type":"paragraph","content":"Modern slavery encompasses slavery, servitude, forced or compulsory labour, and human trafficking. It is estimated that over 100,000 people are victims of modern slavery in the UK."},{"type":"bullet_points","content":["Forced labour: compelled to work under threat","Debt bondage: trapped by manufactured debt","Human trafficking: moved for exploitation","Domestic servitude: enslaved within a household"]},{"type":"highlight","content":"Modern slavery exists in every region of the UK and affects every industry, including agriculture, construction, hospitality, car washes, and retail supply chains."}]'),
(m, 'The Modern Slavery Act 2015', 2, 5, '[{"type":"heading","content":"Key Legal Provisions"},{"type":"paragraph","content":"The Modern Slavery Act 2015 consolidated existing offences and introduced new measures including the Transparency in Supply Chains clause."},{"type":"bullet_points","content":["Maximum life imprisonment for offenders","Slavery and Trafficking Prevention Orders","Defence for victims who commit offences","Organisations with turnover over 36m must publish annual statements","Independent Anti-Slavery Commissioner established"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c6, 'Recognising the Signs', 'Indicators of modern slavery in the workplace', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Physical and Behavioural Indicators', 1, 6, '[{"type":"heading","content":"Warning Signs to Watch For"},{"type":"paragraph","content":"Victims may show physical signs of abuse, appear fearful or withdrawn, and have limited freedom of movement or access to their own documents."},{"type":"bullet_points","content":["Signs of physical abuse or malnutrition","Fearful, anxious, or submissive behaviour","Accompanied and spoken for by another person","No access to identity documents or bank accounts","Living at the workplace or in poor conditions","Working excessively long hours with no days off"]}]'),
(m, 'Supply Chain Red Flags', 2, 6, '[{"type":"heading","content":"Indicators in Business Supply Chains"},{"type":"paragraph","content":"Businesses must be vigilant about their supply chains. Unusually low prices, reluctance to allow site visits, and a workforce that appears controlled are all red flags."},{"type":"bullet_points","content":["Prices significantly below market rate","Workers unable to speak freely or privately","Single person controls all communication","Workers transported to and from work in groups","High staff turnover with little documentation"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c6, 'Reporting and Response', 'How to report concerns and support victims', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'How to Report', 1, 4, '[{"type":"heading","content":"Taking Action"},{"type":"paragraph","content":"If you suspect modern slavery, do not confront the suspected trafficker. Report your concerns through the appropriate channels."},{"type":"bullet_points","content":["Call the Modern Slavery Helpline: 08000 121 700","Contact the police on 101 (or 999 in emergencies)","Report to your line manager or safeguarding lead","Use the online reporting form at modernslaveryhelpline.org"]},{"type":"note","content":"You do not need to be certain. If you have a reasonable suspicion, report it. Trained professionals will assess the situation."}]'),
(m, 'Supporting Victims', 2, 4, '[{"type":"heading","content":"The National Referral Mechanism"},{"type":"paragraph","content":"The NRM is the UK framework for identifying and supporting victims of modern slavery. First responder organisations can make referrals to get victims access to support services."},{"type":"bullet_points","content":["45-day recovery and reflection period","Access to safe accommodation","Legal advice and immigration support","Medical treatment and counselling","Long-term reintegration support"]}]');


-- =============================================
-- COURSE 7: Bribery and Corruption Prevention
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Bribery and Corruption Prevention', 'Understand the Bribery Act 2010, recognise corrupt practices, and learn to maintain ethical business conduct through adequate procedures.', 'step_by_step', 30, cat_legal, 'published', true, 'intermediate', 120, 80)
RETURNING id INTO c7;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c7, 'The Bribery Act 2010', 'UK anti-bribery legislation', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The Four Offences', 1, 5, '[{"type":"heading","content":"Offences Under the Bribery Act 2010"},{"type":"paragraph","content":"The Bribery Act 2010 is one of the strictest anti-corruption laws in the world. It defines four main offences with severe penalties including unlimited fines and up to 10 years imprisonment."},{"type":"bullet_points","content":["Section 1: Offering, promising, or giving a bribe","Section 2: Requesting, agreeing to receive, or accepting a bribe","Section 6: Bribing a foreign public official","Section 7: Failure by a commercial organisation to prevent bribery"]},{"type":"highlight","content":"Under Section 7, a company can be prosecuted if an employee or associate pays a bribe, even if senior management had no knowledge. The only defence is having adequate procedures in place."}]'),
(m, 'What Constitutes a Bribe?', 2, 5, '[{"type":"heading","content":"Understanding Bribery"},{"type":"paragraph","content":"A bribe can be financial or non-financial. It includes any advantage offered to influence someone to act improperly in their role."},{"type":"bullet_points","content":["Cash payments or financial incentives","Lavish gifts or entertainment beyond reasonable hospitality","Job offers or internships for connected persons","Favourable contract terms in exchange for personal benefit","Charitable donations made to influence decisions"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c7, 'Recognising Corrupt Practices', 'Red flags and scenarios', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Common Red Flags', 1, 5, '[{"type":"heading","content":"Warning Signs of Bribery and Corruption"},{"type":"paragraph","content":"Being able to identify red flags is critical for preventing bribery within your organisation."},{"type":"bullet_points","content":["Unusually large or frequent gifts from suppliers","Requests for payments to personal accounts","Pressure to bypass normal procurement procedures","Agent or intermediary fees that seem excessive","Requests for confidential tender information"]},{"type":"note","content":"If something feels wrong, it probably is. Always report concerns through your whistleblowing procedure. You are legally protected from retaliation."}]'),
(m, 'Gifts, Hospitality and Facilitation Payments', 2, 5, '[{"type":"heading","content":"Drawing the Line"},{"type":"paragraph","content":"Reasonable hospitality is not illegal, but it must be proportionate, transparent, and not intended to influence a decision. Facilitation payments are illegal under UK law."},{"type":"bullet_points","content":["All gifts and hospitality must be recorded in a register","Proportionality: is the gesture reasonable for the context?","Transparency: would you be comfortable if it were public?","Facilitation payments are bribes, regardless of local custom","When in doubt, decline and report"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c7, 'Adequate Procedures', 'Building an anti-bribery culture', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The Six Principles', 1, 5, '[{"type":"heading","content":"Ministry of Justice Six Principles"},{"type":"paragraph","content":"The government has published guidance on the six principles that organisations should follow to demonstrate adequate procedures."},{"type":"bullet_points","content":["Proportionate procedures based on risk","Top-level commitment from senior management","Risk assessment of business activities","Due diligence on business partners","Communication and training for all staff","Monitoring and review of procedures"]}]'),
(m, 'Your Personal Responsibilities', 2, 5, '[{"type":"heading","content":"What You Must Do"},{"type":"paragraph","content":"Every employee has a personal responsibility to act with integrity and report any concerns about bribery or corruption."},{"type":"bullet_points","content":["Never offer or accept bribes of any kind","Record all gifts and hospitality received","Report any suspicious requests or behaviour","Complete anti-bribery training as required","Cooperate fully with any investigation"]}]');


-- =============================================
-- COURSE 8: Mental Health First Aid
-- =============================================
INSERT INTO courses (id, title, description, template_style, estimated_duration_minutes, category_id, status, certificate_enabled, difficulty_level, xp_reward, passing_score)
VALUES (gen_random_uuid(), 'CPD: Mental Health First Aid in the Workplace', 'Develop the skills to recognise mental health conditions, provide initial support, and guide colleagues to appropriate professional help in accordance with UK workplace guidance.', 'visual', 40, cat_wellbeing, 'published', true, 'advanced', 160, 80)
RETURNING id INTO c8;

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c8, 'Understanding Mental Health', 'The mental health continuum and common conditions', 1) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The Mental Health Continuum', 1, 5, '[{"type":"heading","content":"Mental Health is a Spectrum"},{"type":"paragraph","content":"Mental health exists on a continuum from thriving to crisis. Everyone moves along this continuum throughout their lives. One in four people in the UK will experience a mental health condition each year."},{"type":"bullet_points","content":["Thriving: good coping, positive relationships, productive","Surviving: some difficulty, intermittent symptoms","Struggling: persistent symptoms, reduced functioning","In crisis: unable to cope, risk to self or others"]},{"type":"highlight","content":"Mental health conditions cost UK employers approximately 56 billion pounds annually through absenteeism, presenteeism, and staff turnover."}]'),
(m, 'Common Workplace Mental Health Conditions', 2, 5, '[{"type":"heading","content":"Conditions You May Encounter"},{"type":"paragraph","content":"The most common mental health conditions in the UK workplace are anxiety, depression, and stress-related illness."},{"type":"bullet_points","content":["Anxiety disorders: excessive worry, panic attacks, phobias","Depression: persistent low mood, loss of interest, fatigue","Work-related stress: overwhelm, burnout, emotional exhaustion","Post-traumatic stress: following workplace incidents","Substance misuse: often co-occurring with other conditions"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c8, 'Recognising Warning Signs', 'Identifying when a colleague needs support', 2) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Behavioural and Physical Indicators', 1, 5, '[{"type":"heading","content":"Signs That Someone May Be Struggling"},{"type":"paragraph","content":"Changes in behaviour, appearance, or performance can indicate mental health difficulties. Trust your observations but avoid making diagnoses."},{"type":"bullet_points","content":["Withdrawal from colleagues and social activities","Increased absenteeism or presenteeism","Decline in work quality or missed deadlines","Changes in eating, sleeping, or personal hygiene","Increased irritability, tearfulness, or emotional outbursts","Expressing hopelessness or making concerning statements"]}]'),
(m, 'Having Supportive Conversations', 2, 5, '[{"type":"heading","content":"Starting the Conversation"},{"type":"paragraph","content":"Approaching someone about their mental health requires sensitivity. Choose a private, comfortable setting and use open, non-judgemental language."},{"type":"bullet_points","content":["Choose a quiet, private space with no interruptions","Use open questions: How are you feeling?","Listen actively without trying to fix the problem","Avoid cliches: cheer up, pull yourself together","Validate their experience: that sounds really difficult","Do not promise confidentiality you cannot keep"]}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c8, 'Providing First Aid Support', 'The ALGEE action plan', 3) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'The ALGEE Framework', 1, 5, '[{"type":"heading","content":"Mental Health First Aid Action Plan"},{"type":"paragraph","content":"ALGEE provides a structured framework for providing mental health first aid, similar to DRSABC in physical first aid."},{"type":"bullet_points","content":["A - Approach, assess, and assist with any crisis","L - Listen and communicate non-judgementally","G - Give support and information","E - Encourage appropriate professional help","E - Encourage other supports (self-help, social)"]},{"type":"note","content":"You are not a therapist. Your role is to provide initial support and help the person access professional help. Knowing your limits is a strength, not a weakness."}]'),
(m, 'Crisis Situations and Signposting', 2, 5, '[{"type":"heading","content":"When Someone is in Crisis"},{"type":"paragraph","content":"If someone expresses suicidal thoughts or intent to self-harm, take it seriously. Stay calm, listen, and help them access immediate support."},{"type":"bullet_points","content":["Ask directly: Are you thinking about suicide? This does not increase risk.","Stay with the person and remove any immediate means","Call 999 if there is immediate danger to life","Samaritans: 116 123 (free, 24/7)","Crisis text line: text SHOUT to 85258","NHS 111 for urgent mental health support"]},{"type":"highlight","content":"Asking someone directly about suicidal thoughts does not plant the idea. Research consistently shows it reduces distress and opens the door to help."}]');

INSERT INTO course_modules (id, course_id, title, description, sort_order)
VALUES (gen_random_uuid(), c8, 'Employer Duties and Self-Care', 'Organisational responsibilities and looking after yourself', 4) RETURNING id INTO m;
INSERT INTO course_lessons (module_id, title, sort_order, estimated_duration_minutes, content) VALUES
(m, 'Employer Legal Duties', 1, 5, '[{"type":"heading","content":"Legal Framework for Workplace Mental Health"},{"type":"paragraph","content":"Under the Health and Safety at Work Act 1974 and the Management of Health and Safety at Work Regulations 1999, employers have a duty to assess and manage risks to mental health."},{"type":"bullet_points","content":["Risk assessments must include psychosocial hazards","Reasonable adjustments under the Equality Act 2010","HSE Management Standards for work-related stress","Occupational health referrals where appropriate","Return to work support following mental health absence"]}]'),
(m, 'Self-Care for Mental Health First Aiders', 2, 5, '[{"type":"heading","content":"Looking After Yourself"},{"type":"paragraph","content":"Supporting others with mental health difficulties can be emotionally demanding. Establishing boundaries and maintaining your own wellbeing is essential."},{"type":"bullet_points","content":["Debrief with a trusted colleague after difficult conversations","Maintain clear boundaries between support and friendship","Access supervision or peer support regularly","Recognise signs of compassion fatigue in yourself","Practice what you recommend: exercise, sleep, connection"]},{"type":"note","content":"You cannot pour from an empty cup. Regular self-care is not optional for mental health first aiders; it is a professional necessity."}]');

END $$;
