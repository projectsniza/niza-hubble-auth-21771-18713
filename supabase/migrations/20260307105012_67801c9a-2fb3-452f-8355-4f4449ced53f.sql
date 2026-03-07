
-- Certificate design configuration table
CREATE TABLE IF NOT EXISTS public.certificate_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  border_style TEXT NOT NULL DEFAULT 'classic',
  border_color TEXT NOT NULL DEFAULT '#0066B3',
  accent_color TEXT NOT NULL DEFAULT '#00A3E0',
  background_color TEXT NOT NULL DEFAULT '#FFFFFF',
  text_color TEXT NOT NULL DEFAULT '#1a1a1a',
  font_family TEXT NOT NULL DEFAULT 'serif',
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_signature BOOLEAN NOT NULL DEFAULT true,
  signature_name TEXT DEFAULT 'Training Director',
  signature_title TEXT DEFAULT 'Niza Group',
  custom_footer_text TEXT DEFAULT 'This certificate verifies the successful completion of the above-mentioned course.',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage certificate designs"
ON public.certificate_designs FOR ALL
TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('super_admin', 'hr')
)
WITH CHECK (
  public.get_user_role(auth.uid()) IN ('super_admin', 'hr')
);

CREATE POLICY "All authenticated users can view certificate designs"
ON public.certificate_designs FOR SELECT
TO authenticated
USING (true);

-- Add columns to elearning_certificates
ALTER TABLE public.elearning_certificates
ADD COLUMN IF NOT EXISTS verification_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS design_id UUID REFERENCES public.certificate_designs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS employee_name TEXT,
ADD COLUMN IF NOT EXISTS course_title TEXT;

-- Create course categories for UK retail
INSERT INTO public.course_categories (id, name, description, color)
VALUES 
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Health & Safety', 'Workplace health and safety training', '#ef4444'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Customer Service', 'Customer handling and service excellence', '#3b82f6'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Compliance', 'UK regulatory and legal compliance', '#8b5cf6'),
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'Operations', 'Store operations and procedures', '#10b981')
ON CONFLICT (id) DO NOTHING;

-- Insert 4 sample UK retail courses
INSERT INTO public.courses (id, title, description, template_style, estimated_duration_minutes, status, certificate_enabled, passing_score, category_id)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Workplace Health & Safety in Retail', 'A comprehensive course covering UK workplace health and safety regulations for retail environments. Learn about hazard identification, risk assessment, fire safety, manual handling, and your legal responsibilities under the Health and Safety at Work Act 1974.', 'classic', 30, 'published', true, 70, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
  ('22222222-2222-2222-2222-222222222222', 'Customer Service Excellence', 'Master the art of exceptional customer service in UK retail. This course covers handling complaints, upselling techniques, accessibility awareness, and creating memorable customer experiences that drive loyalty and repeat business.', 'interactive', 30, 'published', true, 70, 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  ('33333333-3333-3333-3333-333333333333', 'UK Food Safety & Hygiene (Level 2)', 'Essential food safety and hygiene training aligned with UK Food Standards Agency guidelines. Covers HACCP principles, allergen management, temperature control, personal hygiene, cross-contamination prevention, and Natasha''s Law compliance.', 'step_by_step', 30, 'published', true, 80, 'c3d4e5f6-a7b8-9012-cdef-123456789012'),
  ('44444444-4444-4444-4444-444444444444', 'Forecourt Operations & Fuel Safety', 'Complete training on forecourt operations including fuel dispensing safety, drive-off procedures, LPG handling, spill response, environmental compliance, and emergency shutdown procedures. Essential for all forecourt staff.', 'visual', 30, 'published', true, 75, 'd4e5f6a7-b8c9-0123-defa-234567890123')
ON CONFLICT (id) DO NOTHING;

-- Course 1: Workplace H&S - Modules
INSERT INTO public.course_modules (id, course_id, title, description, sort_order) VALUES
  ('10000001-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Introduction to H&S Law', 'Understanding UK health and safety legislation', 1),
  ('10000002-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Hazard Identification & Risk Assessment', 'Spotting hazards and assessing risks in retail', 2),
  ('10000003-0001-0001-0001-000000000001', '11111111-1111-1111-1111-111111111111', 'Fire Safety & Emergency Procedures', 'Fire prevention and emergency response', 3)
ON CONFLICT (id) DO NOTHING;

-- Course 1: Lessons
INSERT INTO public.course_lessons (id, module_id, title, sort_order, estimated_duration_minutes, content) VALUES
  ('10000001-0001-0001-0001-100000000001', '10000001-0001-0001-0001-000000000001', 'The Health and Safety at Work Act 1974', 1, 5, '[{"type":"heading","content":"The Health and Safety at Work Act 1974"},{"type":"paragraph","content":"The HSWA is the primary piece of legislation covering occupational health and safety in the UK. It sets out the general duties employers have towards employees and the public."},{"type":"infobox","content":"Key Principle: Every employer has a duty to ensure, so far as is reasonably practicable, the health, safety and welfare at work of all employees."},{"type":"bullets","content":["Employers must provide safe systems of work","Risk assessments must be carried out regularly","Safety equipment and PPE must be provided free of charge","Employees must receive adequate training","The workplace must be maintained in a safe condition"]},{"type":"highlight","content":"Failure to comply can result in unlimited fines and up to 2 years imprisonment."}]'::jsonb),
  ('10000002-0001-0001-0001-100000000001', '10000001-0001-0001-0001-000000000001', 'Employer and Employee Responsibilities', 2, 5, '[{"type":"heading","content":"Responsibilities in the Workplace"},{"type":"paragraph","content":"Both employers and employees have legal responsibilities under UK health and safety law."},{"type":"subheading","content":"Employer Duties"},{"type":"bullets","content":["Provide a safe working environment","Conduct and review risk assessments","Provide adequate welfare facilities","Display the health and safety law poster","Report certain accidents under RIDDOR"]},{"type":"subheading","content":"Employee Duties"},{"type":"bullets","content":["Take reasonable care of your own health and safety","Cooperate with your employer on safety matters","Not interfere with or misuse safety provisions","Report hazards and defects to your supervisor","Use equipment and PPE as trained"]},{"type":"quote","content":"Safety is everyone''s responsibility – from the shop floor to the boardroom."}]'::jsonb),
  ('10000003-0001-0001-0001-100000000001', '10000002-0001-0001-0001-000000000001', 'Common Retail Hazards', 1, 5, '[{"type":"heading","content":"Identifying Common Retail Hazards"},{"type":"paragraph","content":"Retail environments present a variety of hazards that staff must identify and manage."},{"type":"bullets","content":["Slip, trip and fall hazards – wet floors, trailing cables","Manual handling injuries – lifting heavy stock","Display and shelving hazards – unstable displays","Workplace violence – aggressive customers","Electrical hazards – faulty equipment","Fire hazards – blocked exits, flammable materials"]},{"type":"infobox","content":"Slips, trips and falls account for over 30% of all reported injuries in the retail sector."},{"type":"paragraph","content":"Always report hazards immediately. Never assume someone else has already reported it."}]'::jsonb),
  ('10000004-0001-0001-0001-100000000001', '10000002-0001-0001-0001-000000000001', 'Risk Assessment Process', 2, 5, '[{"type":"heading","content":"The 5 Steps of Risk Assessment"},{"type":"paragraph","content":"Risk assessment is a legal requirement under the Management of Health and Safety at Work Regulations 1999."},{"type":"bullets","content":["Step 1: Identify the hazards","Step 2: Decide who might be harmed and how","Step 3: Evaluate the risks and decide on precautions","Step 4: Record your findings and implement them","Step 5: Review your assessment and update if necessary"]},{"type":"highlight","content":"Risk assessments must be reviewed regularly and whenever there are significant changes."},{"type":"paragraph","content":"Use the risk matrix: Likelihood × Severity = Risk Rating."}]'::jsonb),
  ('10000005-0001-0001-0001-100000000001', '10000003-0001-0001-0001-000000000001', 'Fire Safety Essentials', 1, 5, '[{"type":"heading","content":"Fire Safety in Retail Premises"},{"type":"paragraph","content":"Under the Regulatory Reform (Fire Safety) Order 2005, the responsible person must carry out a fire risk assessment."},{"type":"subheading","content":"Fire Prevention"},{"type":"bullets","content":["Keep fire exits clear and unlocked","Store flammable materials properly","Maintain electrical equipment","Never overload sockets","Keep premises clean and tidy"]},{"type":"subheading","content":"Emergency Procedures"},{"type":"bullets","content":["Know all fire exits and assembly points","Understand fire extinguisher use (PASS technique)","Never use lifts during evacuation","Assist customers and colleagues","Account for all staff at assembly point"]},{"type":"infobox","content":"PASS Technique: Pull the pin → Aim at the base → Squeeze the handle → Sweep side to side"}]'::jsonb),
  ('10000006-0001-0001-0001-100000000001', '10000003-0001-0001-0001-000000000001', 'Accident Reporting & First Aid', 2, 5, '[{"type":"heading","content":"Accident Reporting & First Aid"},{"type":"paragraph","content":"All workplace accidents must be recorded. Certain accidents must be reported under RIDDOR 2013."},{"type":"subheading","content":"RIDDOR Reportable Incidents"},{"type":"bullets","content":["Deaths and specified injuries","Over-7-day incapacitation","Non-fatal accidents to non-workers","Occupational diseases","Dangerous occurrences"]},{"type":"subheading","content":"First Aid Requirements"},{"type":"bullets","content":["Every workplace must have a first aid box","Appointed persons or qualified first aiders must be available","First aid information must be displayed","Records must be kept for at least 3 years"]},{"type":"quote","content":"When in doubt, always seek medical assistance."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Course 2: Customer Service - Modules
INSERT INTO public.course_modules (id, course_id, title, description, sort_order) VALUES
  ('20000001-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Foundations of Great Service', 'Building blocks of customer service', 1),
  ('20000002-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Handling Complaints & Difficult Situations', 'Managing challenging interactions', 2),
  ('20000003-0002-0002-0002-000000000002', '22222222-2222-2222-2222-222222222222', 'Going Above & Beyond', 'Creating memorable experiences', 3)
ON CONFLICT (id) DO NOTHING;

-- Course 2: Lessons
INSERT INTO public.course_lessons (id, module_id, title, sort_order, estimated_duration_minutes, content) VALUES
  ('20000001-0002-0002-0002-100000000002', '20000001-0002-0002-0002-000000000002', 'The Customer Journey', 1, 5, '[{"type":"heading","content":"Understanding the Customer Journey"},{"type":"paragraph","content":"Every interaction is an opportunity to create a positive impression."},{"type":"subheading","content":"Key Touchpoints"},{"type":"bullets","content":["Greeting – Acknowledge within 10 seconds","Browsing – Available but not intrusive","Assistance – Proactive and knowledgeable","Checkout – Efficient and friendly","Farewell – Thank and invite back"]},{"type":"infobox","content":"73% of UK consumers say friendly staff is the most important factor in their shopping experience."}]'::jsonb),
  ('20000002-0002-0002-0002-100000000002', '20000001-0002-0002-0002-000000000002', 'Communication Skills', 2, 5, '[{"type":"heading","content":"Effective Communication in Retail"},{"type":"subheading","content":"Active Listening"},{"type":"bullets","content":["Give full attention","Don''t interrupt","Paraphrase to confirm","Ask clarifying questions","Show empathy"]},{"type":"subheading","content":"Body Language"},{"type":"bullets","content":["Maintain eye contact","Open body posture","Smile genuinely","Nod to show understanding"]},{"type":"highlight","content":"55% of communication is body language, 38% tone, 7% words."}]'::jsonb),
  ('20000003-0002-0002-0002-100000000002', '20000002-0002-0002-0002-000000000002', 'The LAST Complaint Handling Model', 1, 5, '[{"type":"heading","content":"Handling Complaints with LAST"},{"type":"subheading","content":"L – Listen"},{"type":"paragraph","content":"Let the customer explain fully without interruption."},{"type":"subheading","content":"A – Apologise"},{"type":"paragraph","content":"Offer a sincere apology for the inconvenience."},{"type":"subheading","content":"S – Solve"},{"type":"paragraph","content":"Take ownership and find a solution."},{"type":"subheading","content":"T – Thank"},{"type":"paragraph","content":"Thank the customer for bringing the issue to your attention."},{"type":"infobox","content":"Under the Consumer Rights Act 2015, customers have the right to a refund, repair, or replacement for faulty goods within 30 days."}]'::jsonb),
  ('20000004-0002-0002-0002-100000000002', '20000002-0002-0002-0002-000000000002', 'Dealing with Aggressive Behaviour', 2, 5, '[{"type":"heading","content":"Managing Aggressive Customer Behaviour"},{"type":"subheading","content":"De-escalation Techniques"},{"type":"bullets","content":["Stay calm, speak in a low steady tone","Don''t take it personally","Maintain safe physical distance","Acknowledge frustration","Offer solutions not excuses","Know when to involve a manager"]},{"type":"highlight","content":"Never put yourself at risk. If threatened, step away and call for help immediately."}]'::jsonb),
  ('20000005-0002-0002-0002-100000000002', '20000003-0002-0002-0002-000000000002', 'Creating Wow Moments', 1, 5, '[{"type":"heading","content":"Going the Extra Mile"},{"type":"bullets","content":["Remember regular customers'' names","Walk customers to products","Offer to carry heavy items","Provide personalised recommendations","Follow up on special orders","Celebrate customer milestones"]},{"type":"quote","content":"Customers will never forget how you made them feel. – Maya Angelou"},{"type":"paragraph","content":"A delighted customer tells an average of 9 people about their experience."}]'::jsonb),
  ('20000006-0002-0002-0002-100000000002', '20000003-0002-0002-0002-000000000002', 'Accessibility & Inclusivity', 2, 5, '[{"type":"heading","content":"Inclusive Customer Service"},{"type":"paragraph","content":"Under the Equality Act 2010, businesses must make reasonable adjustments for disabled customers."},{"type":"bullets","content":["Never assume what someone can or cannot do","Ask how you can help","Be patient with those needing more time","Ensure aisles are clear for wheelchair access","Learn basic sign language greetings"]},{"type":"infobox","content":"The Purple Pound: Disabled consumers spend £274 billion annually in the UK."},{"type":"paragraph","content":"Look for the sunflower lanyard as a signal of hidden disabilities."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Course 3: Food Safety - Modules
INSERT INTO public.course_modules (id, course_id, title, description, sort_order) VALUES
  ('30000001-0003-0003-0003-000000000003', '33333333-3333-3333-3333-333333333333', 'Food Safety Fundamentals', 'Core food safety principles', 1),
  ('30000002-0003-0003-0003-000000000003', '33333333-3333-3333-3333-333333333333', 'Contamination & Allergens', 'Preventing contamination and managing allergens', 2),
  ('30000003-0003-0003-0003-000000000003', '33333333-3333-3333-3333-333333333333', 'Temperature Control & Storage', 'Safe food storage and temperature management', 3)
ON CONFLICT (id) DO NOTHING;

-- Course 3: Lessons
INSERT INTO public.course_lessons (id, module_id, title, sort_order, estimated_duration_minutes, content) VALUES
  ('30000001-0003-0003-0003-100000000003', '30000001-0003-0003-0003-000000000003', 'Food Safety Law in the UK', 1, 5, '[{"type":"heading","content":"UK Food Safety Legislation"},{"type":"bullets","content":["Food Safety Act 1990","Food Safety and Hygiene (England) Regulations 2013","EC Regulation 852/2004","Natasha''s Law 2021 – Allergen labelling for PPDS foods"]},{"type":"infobox","content":"Due Diligence Defence: Prove you took all reasonable precautions and exercised all due diligence."},{"type":"paragraph","content":"Environmental Health Officers can inspect premises without notice and can prosecute non-compliant businesses."}]'::jsonb),
  ('30000002-0003-0003-0003-100000000003', '30000001-0003-0003-0003-000000000003', 'Personal Hygiene Standards', 2, 5, '[{"type":"heading","content":"Personal Hygiene for Food Handlers"},{"type":"subheading","content":"Hand Washing Procedure"},{"type":"bullets","content":["Wet hands with warm water","Apply antibacterial soap","Rub for at least 20 seconds","Clean between fingers and under nails","Rinse thoroughly","Dry with disposable towels"]},{"type":"highlight","content":"Wash hands: before handling food, after toilet, after handling raw food, after touching face/hair, after handling waste."},{"type":"paragraph","content":"You must be symptom-free for 48 hours before returning to food handling after illness."}]'::jsonb),
  ('30000003-0003-0003-0003-100000000003', '30000002-0003-0003-0003-000000000003', 'Types of Contamination', 1, 5, '[{"type":"heading","content":"Understanding Food Contamination"},{"type":"subheading","content":"Physical Contamination"},{"type":"paragraph","content":"Foreign objects: glass, metal, hair, plasters. Always wear blue plasters and hair nets."},{"type":"subheading","content":"Chemical Contamination"},{"type":"paragraph","content":"Cleaning products or pesticides contacting food. Store chemicals separately."},{"type":"subheading","content":"Biological Contamination"},{"type":"paragraph","content":"Bacteria, viruses, moulds, parasites – the most dangerous type."},{"type":"infobox","content":"The Big Four: Salmonella, E. coli O157, Listeria, and Campylobacter."}]'::jsonb),
  ('30000004-0003-0003-0003-100000000003', '30000002-0003-0003-0003-000000000003', 'Allergen Management & Natasha''s Law', 2, 5, '[{"type":"heading","content":"Allergen Management"},{"type":"paragraph","content":"Natasha''s Law requires full ingredient labelling on PPDS food including allergens."},{"type":"subheading","content":"The 14 Major Allergens"},{"type":"bullets","content":["Celery","Cereals containing gluten","Crustaceans","Eggs","Fish","Lupin","Milk","Molluscs","Mustard","Nuts","Peanuts","Sesame","Soybeans","Sulphur dioxide"]},{"type":"highlight","content":"Never guess about allergen content. An incorrect answer could be fatal."}]'::jsonb),
  ('30000005-0003-0003-0003-100000000003', '30000003-0003-0003-0003-000000000003', 'Temperature Control', 1, 5, '[{"type":"heading","content":"Safe Temperature Control"},{"type":"bullets","content":["Fridge: 1°C to 5°C (legal max 8°C)","Freezer: -18°C or below","Hot holding: 63°C or above","Cooking core: 75°C for 30 seconds","Danger zone: 8°C to 63°C"]},{"type":"infobox","content":"The 90-Minute Rule: Chilled food out of temperature control for more than 90 minutes must be disposed of."},{"type":"paragraph","content":"Temperature checks must be recorded at least twice daily for fridges and freezers."}]'::jsonb),
  ('30000006-0003-0003-0003-100000000003', '30000003-0003-0003-0003-000000000003', 'Stock Rotation & FIFO', 2, 5, '[{"type":"heading","content":"Stock Rotation & FIFO"},{"type":"subheading","content":"FIFO Procedure"},{"type":"bullets","content":["Check use-by dates on deliveries","Place new stock behind existing stock","Remove items past use-by date immediately","Date-mark transferred food","Keep storage areas clean"]},{"type":"highlight","content":"Use-By vs Best-Before: Food must NEVER be sold after its use-by date (legal requirement). Best-before is about quality, not safety."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Course 4: Forecourt Operations - Modules
INSERT INTO public.course_modules (id, course_id, title, description, sort_order) VALUES
  ('40000001-0004-0004-0004-000000000004', '44444444-4444-4444-4444-444444444444', 'Forecourt Safety Essentials', 'Core safety on the forecourt', 1),
  ('40000002-0004-0004-0004-000000000004', '44444444-4444-4444-4444-444444444444', 'Fuel Operations & Procedures', 'Safe fuel dispensing and procedures', 2),
  ('40000003-0004-0004-0004-000000000004', '44444444-4444-4444-4444-444444444444', 'Emergency Response', 'Handling forecourt emergencies', 3)
ON CONFLICT (id) DO NOTHING;

-- Course 4: Lessons
INSERT INTO public.course_lessons (id, module_id, title, sort_order, estimated_duration_minutes, content) VALUES
  ('40000001-0004-0004-0004-100000000004', '40000001-0004-0004-0004-000000000004', 'Forecourt Hazards & Controls', 1, 5, '[{"type":"heading","content":"Understanding Forecourt Hazards"},{"type":"bullets","content":["Flammable fuel vapours","Vehicle movements and drive-offs","Slippery surfaces from fuel spills","Static electricity ignition risk","Manual handling of LPG cylinders","Confined spaces"]},{"type":"infobox","content":"Petrol vapour is heavier than air and can travel significant distances. A distant spark could ignite it."},{"type":"paragraph","content":"All forecourt staff must complete a site-specific safety induction before working unsupervised."}]'::jsonb),
  ('40000002-0004-0004-0004-100000000004', '40000001-0004-0004-0004-000000000004', 'PPE & Safe Conduct', 2, 5, '[{"type":"heading","content":"PPE & Safe Practices"},{"type":"subheading","content":"Required PPE"},{"type":"bullets","content":["High-visibility vest at all times","Safety footwear for deliveries","Chemical-resistant gloves for spills","Eye protection for chemicals","Anti-static clothing near fuel"]},{"type":"subheading","content":"Prohibited Activities"},{"type":"bullets","content":["No smoking on forecourt","No mobile phones near pumps","No naked flames","No running engines while refuelling","No unapproved fuel containers"]},{"type":"highlight","content":"Remind customers of these rules using PA system or polite approach."}]'::jsonb),
  ('40000003-0004-0004-0004-100000000004', '40000002-0004-0004-0004-000000000004', 'Fuel Dispensing Operations', 1, 5, '[{"type":"heading","content":"Safe Fuel Dispensing"},{"type":"subheading","content":"Authorising Pumps"},{"type":"bullets","content":["Verify customer readiness via CCTV","Check no safety hazards at pump","Authorise from console","Monitor transaction","Process payment accurately"]},{"type":"subheading","content":"Drive-Off Procedures"},{"type":"bullets","content":["Record vehicle registration immediately","Note pump number, fuel type, amount","Save CCTV footage","Complete drive-off report","Do NOT attempt to stop the vehicle"]},{"type":"infobox","content":"Safety First: Never put yourself at risk over a drive-off."}]'::jsonb),
  ('40000004-0004-0004-0004-100000000004', '40000002-0004-0004-0004-000000000004', 'LPG & Fuel Deliveries', 2, 5, '[{"type":"heading","content":"LPG Handling & Fuel Deliveries"},{"type":"subheading","content":"LPG Safety"},{"type":"bullets","content":["Store cylinders upright in designated cage","Adhere to maximum storage quantities","Keep cage locked and secured","Check cylinders for damage","Never store LPG indoors"]},{"type":"subheading","content":"Fuel Delivery Protocol"},{"type":"bullets","content":["Clear delivery area of vehicles and pedestrians","Tanker driver manages delivery","Monitor for spills","Check dip readings before and after","Sign documentation when satisfied"]},{"type":"highlight","content":"During fuel deliveries, vapour levels are highest – increased ignition risk."}]'::jsonb),
  ('40000005-0004-0004-0004-100000000004', '40000003-0004-0004-0004-000000000004', 'Emergency Shutdown', 1, 5, '[{"type":"heading","content":"Emergency Shutdown Procedures"},{"type":"subheading","content":"When to Activate EPS"},{"type":"bullets","content":["Fire on the forecourt","Significant fuel spill","Vehicle collision with pump","Immediate danger situation","Electrical fault"]},{"type":"subheading","content":"EPS Activation Steps"},{"type":"bullets","content":["Press Emergency Pump Shutdown button","Call 999","Evacuate to assembly point","Do NOT fight fuel fires unless trained","Alert manager and emergency contacts"]},{"type":"infobox","content":"Know Your EPS Locations: At least one inside kiosk and one on forecourt. Locate them on your first day."}]'::jsonb),
  ('40000006-0004-0004-0004-100000000004', '40000003-0004-0004-0004-000000000004', 'Spill Response & Environmental', 2, 5, '[{"type":"heading","content":"Spill Response & Environmental Compliance"},{"type":"subheading","content":"Spill Response Steps"},{"type":"bullets","content":["Stop the source if safe","Prevent spill reaching drains","Apply absorbent granules","Sweep up and dispose as hazardous waste","Report and complete incident report"]},{"type":"subheading","content":"Environmental Responsibilities"},{"type":"bullets","content":["Interceptors must be maintained","Contaminated materials are hazardous waste","Use licensed waste carriers","Keep records of all waste transfers"]},{"type":"highlight","content":"Polluting a watercourse can result in unlimited fines and criminal prosecution."}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Assessments for each course
INSERT INTO public.course_assessments (id, course_id, title, passing_score, max_attempts, time_limit_minutes) VALUES
  ('a1000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Health & Safety Assessment', 70, 3, 15),
  ('a2000001-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Customer Service Assessment', 70, 3, 15),
  ('a3000001-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Food Safety Assessment', 80, 3, 15),
  ('a4000001-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Forecourt Safety Assessment', 75, 3, 15)
ON CONFLICT (id) DO NOTHING;

-- Assessment questions for H&S course
INSERT INTO public.assessment_questions (assessment_id, question_text, question_type, options, correct_answer, explanation, points, sort_order) VALUES
  ('a1000001-0000-0000-0000-000000000001', 'What is the primary health and safety legislation in the UK?', 'multiple_choice', '["Health and Safety at Work Act 1974","Fire Safety Order 2005","RIDDOR 2013","Management of H&S Regulations 1999"]'::jsonb, '"Health and Safety at Work Act 1974"'::jsonb, 'The HSWA 1974 is the primary piece of H&S legislation.', 10, 1),
  ('a1000001-0000-0000-0000-000000000001', 'Slips, trips and falls account for what percentage of retail injuries?', 'multiple_choice', '["10%","20%","Over 30%","50%"]'::jsonb, '"Over 30%"'::jsonb, 'HSE statistics confirm over 30%.', 10, 2),
  ('a1000001-0000-0000-0000-000000000001', 'How many steps are in a risk assessment?', 'multiple_choice', '["3","4","5","6"]'::jsonb, '"5"'::jsonb, 'HSE recommends 5 steps.', 10, 3),
  ('a1000001-0000-0000-0000-000000000001', 'What does PASS stand for?', 'multiple_choice', '["Push Aim Spray Sweep","Pull Aim Squeeze Sweep","Press Aim Squeeze Spray","Pull Alert Squeeze Sweep"]'::jsonb, '"Pull Aim Squeeze Sweep"'::jsonb, 'PASS: Pull, Aim, Squeeze, Sweep.', 10, 4),
  ('a1000001-0000-0000-0000-000000000001', 'Employees must cooperate with their employer on safety matters.', 'true_false', '["True","False"]'::jsonb, '"True"'::jsonb, 'Legal duty under HSWA.', 10, 5),
  ('a1000001-0000-0000-0000-000000000001', 'Minimum fire drills per year?', 'multiple_choice', '["1","2","4","6"]'::jsonb, '"2"'::jsonb, 'At least twice annually.', 10, 6),
  ('a1000001-0000-0000-0000-000000000001', 'RIDDOR stands for Reporting of Injuries, Diseases and Dangerous Occurrences Regulations.', 'true_false', '["True","False"]'::jsonb, '"True"'::jsonb, 'Correct full name.', 10, 7),
  ('a1000001-0000-0000-0000-000000000001', 'How long must first aid records be kept?', 'multiple_choice', '["1 year","2 years","3 years","5 years"]'::jsonb, '"3 years"'::jsonb, 'Minimum 3 years.', 10, 8),
  ('a1000001-0000-0000-0000-000000000001', 'Employers can charge employees for PPE.', 'true_false', '["True","False"]'::jsonb, '"False"'::jsonb, 'PPE must be free.', 10, 9),
  ('a1000001-0000-0000-0000-000000000001', 'Maximum penalty for HSWA non-compliance?', 'multiple_choice', '["£5,000 fine","£20,000 fine","Unlimited fine and up to 2 years imprisonment","£50,000 fine"]'::jsonb, '"Unlimited fine and up to 2 years imprisonment"'::jsonb, 'Unlimited fines and imprisonment.', 10, 10);

-- Assessment questions for Customer Service course
INSERT INTO public.assessment_questions (assessment_id, question_text, question_type, options, correct_answer, explanation, points, sort_order) VALUES
  ('a2000001-0000-0000-0000-000000000002', 'Acknowledge customers within how many seconds?', 'multiple_choice', '["5","10","30","60"]'::jsonb, '"10"'::jsonb, 'Best practice is 10 seconds.', 10, 1),
  ('a2000001-0000-0000-0000-000000000002', 'What does LAST stand for?', 'multiple_choice', '["Listen Apologise Solve Thank","Look Ask Solve Tell","Listen Act Solve Track","Learn Apologise Solve Thank"]'::jsonb, '"Listen Apologise Solve Thank"'::jsonb, 'The LAST complaint model.', 10, 2),
  ('a2000001-0000-0000-0000-000000000002', 'Consumer Rights Act 2015 refund period for faulty goods?', 'multiple_choice', '["14 days","28 days","30 days","60 days"]'::jsonb, '"30 days"'::jsonb, '30 days for full refund.', 10, 3),
  ('a2000001-0000-0000-0000-000000000002', 'What percentage of communication is body language?', 'multiple_choice', '["7%","38%","55%","70%"]'::jsonb, '"55%"'::jsonb, 'Mehrabian rule: 55%.', 10, 4),
  ('a2000001-0000-0000-0000-000000000002', 'It is acceptable to physically confront aggressive customers.', 'true_false', '["True","False"]'::jsonb, '"False"'::jsonb, 'Never put yourself at risk.', 10, 5),
  ('a2000001-0000-0000-0000-000000000002', 'The Purple Pound is estimated at?', 'multiple_choice', '["£50 billion","£150 billion","£274 billion","£400 billion"]'::jsonb, '"£274 billion"'::jsonb, '£274 billion annually.', 10, 6),
  ('a2000001-0000-0000-0000-000000000002', 'Which law requires reasonable adjustments for disabled customers?', 'multiple_choice', '["Consumer Rights Act 2015","Equality Act 2010","Disability Discrimination Act 1995","Human Rights Act 1998"]'::jsonb, '"Equality Act 2010"'::jsonb, 'Equality Act 2010.', 10, 7),
  ('a2000001-0000-0000-0000-000000000002', 'Delighted customers tell how many people?', 'multiple_choice', '["3","5","9","15"]'::jsonb, '"9"'::jsonb, 'Average of 9 people.', 10, 8),
  ('a2000001-0000-0000-0000-000000000002', 'The sunflower lanyard indicates visible disabilities.', 'true_false', '["True","False"]'::jsonb, '"False"'::jsonb, 'It indicates hidden disabilities.', 10, 9),
  ('a2000001-0000-0000-0000-000000000002', 'Active listening includes paraphrasing.', 'true_false', '["True","False"]'::jsonb, '"True"'::jsonb, 'Core active listening skill.', 10, 10);

-- Default certificate design
INSERT INTO public.certificate_designs (id, name, is_default, border_style, border_color, accent_color, signature_name, signature_title)
VALUES ('00000000-0000-0000-0000-000000000001', 'Niza Professional', true, 'classic', '#0066B3', '#00A3E0', 'Training Director', 'Niza Group')
ON CONFLICT (id) DO NOTHING;
