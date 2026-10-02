# Restore the complete employment contract wording

## What will change
- Use the four uploaded contracts as the authoritative wording for clauses 1–19.
- Add every substantive sentence currently omitted or shortened, including bank-holiday premium pay, excess-holiday recovery, full sickness/medical consent, staff-purchase rules, suspension grounds, grievance deadlines and accompaniment rights, all warning durations, the statutory three-step dismissal process, and employer notice.
- Apply the same complete wording to the contract shown during onboarding and to both full PDF download paths, so approved/store downloads match what Super Admin reviewed.
- Preserve all existing employee/company merge fields and organisation-specific salary type handling.

## What will remain unchanged
- A4 page size, margins, typography, logo/header line, page-break behavior, filename, and signature areas.
- Existing contract approval, signing, editing, storage, and download workflows.

## Verification
- Compare the final clause text against the uploaded originals.
- Generate a representative contract PDF, render every page, and inspect for clipping, overlaps, orphan headings, or signature displacement.
- Check the app build and contract preview.

## Technical notes
- Update both independent PDF generators and the on-screen contract text together to prevent store downloads from using shortened wording.
- Keep the existing PDF drawing helpers and layout constants unchanged; only clause text and necessary clause numbering are updated.
