# NOAI research and proposed build

Research date: October 9, 2026. Status: research completed; product design proposed; application implementation has not started.

## Direction

Build a festival dispatch desk that helps organizers promote individual talks and speakers across their social channels. Ground every draft in the current published program, preserve each speaker's subject and voice, and make the factual details and tagging decisions easy to review.

The mood is curious, playful, hands-on, and community-minded. Think of a community salon, a print shop, and a working-demo table sharing one room. This is an interpretation of the program and existing visual identity, rather than a claim about an official brand strategy.

The official 2026 theme is **Arts & Ideas**. The festival runs November 11–13 at the New Orleans Jazz Museum. The organizer's stated guiding question is how to do good better. Those points should anchor the product's language.

## Evidence and scope

I read the official schedule's public data feed and all 42 presentation descriptions linked from its 2026 schedule. The feed contains 48 schedule entries, including receptions, lunch, panels, workshops, parties, and other sessions. Those are not 48 talks. Its 175 presentation records include earlier years and material outside the current schedule; membership in the 2026 schedule is the inclusion rule.

The schedule has 14 entries on Wednesday, 17 on Thursday, and 17 on Friday. These counts include simultaneous tracks and logistics. Six entries have no linked presentation record, including The Ella Project and the aggregate evening party listing. Fourteen schedule entries have no explicit format label.

I also inspected the festival's About page, the venue's event listing, the public site's current stylesheet, and separately supplied profile candidates. Candidates do not establish that a talk is scheduled or that a profile is the correct account to tag. Their original private submission references are omitted from this public repository; `data/profile-candidates.json` marks those references as `private-provenance-unavailable` rather than substituting an unrelated public source.

Sources:

- [Current official program](https://fest.philosophers.group/).
- [Official program data used by that schedule](https://fest.philosophers.group/content.json). The schedule application explicitly fetches this file.
- [Festival About page](https://fest.philosophers.group/about/).
- [Venue's 2026 listing](https://nolajazzmuseum.org/events/2026/11/12/noai).
- [Current site styles](https://fest.philosophers.group/_astro/app.B3JSa_3D.css). Exact tokens below were read from this asset; its filename is a snapshot, not a stable integration URL.
- Private organizer workflow notes and schedule announcement: original references omitted from this public repository.

The current site renders most schedule and presentation content in the browser. Search snippets can mix historical descriptions with current schedule fragments. I used the current data feed to resolve that ambiguity. Presentation links in this brief follow the site's observed route convention; the full set of routes has not been individually checked.

## What the talks suggest

These are editorial groupings for promotion, not official tracks or accepted classifications.

| Theme | Representative scheduled sessions | Mood and promotional angle |
| --- | --- | --- |
| Human craft and intention | Joseph Makkos: Analog Intelligence Since 1440; Julia Feliciano: Why Machines Cannot Crochet; Marcus Rosser and Kaylon Seaberry: The Intentional Page | Material, tactile, attentive. Lead with making something and understanding the choices involved. |
| Creative experimentation | Cam'ron Caldwell: Nobody Asked for This; Steven Achord: Design Better With AI; Dan Woods: The Message Runner | Curious and lightly irreverent. Make room for experiments, taste, and creative practice. |
| Public value and civic agency | JP Morrell: Is AI Acceleration Good for New Orleans?; Civic and Community Engaged AI in New Orleans | Local and questioning. Ask who benefits, whose judgment matters, and how people participate. |
| Useful technology people can own | Marcus Rosser: Open the Studio; Vanessa Pyne: an offline voice AI bot workshop; Legare Kerrison: Local Agents Crash Course | Practical and open. Promote what participants can try, adapt, or run themselves. |
| Learning, judgment, and evidence | Rebecca Gaillot: Designing an AI Literacy Course; Blaine Fisher: Explain It; Dustin T. Hughes: The Most Valuable AI Skill Is Saying No; Dustin Gaspard: AI Made Us Faster. Evidence Makes Us Confident. | Clear-eyed and useful. Emphasize the decision, skill, or evidence a session explores. |
| New Orleans sociability and play | Baylee Badawy and Jude Acers: street chess and ice cream; Grace Bertuccelli-Booth: Intro to Clown; the secondline and evening parties | Welcoming and participatory. Show how attendees can join in and meet one another. |

Representative primary links:

- [Letterpress workshop](https://fest.philosophers.group/p/analog-intelligence-since-1440-a-hands-on-letterpress-workshop-by-joseph-makkos/).
- [Crochet workshop](https://fest.philosophers.group/p/why-machines-cannot-crochet-by-julia-feliciano/).
- [Nobody Asked for This](https://fest.philosophers.group/p/nobody-asked-for-this-by-camron-caldwell/).
- [AI acceleration fireside chat](https://fest.philosophers.group/p/keynote-is-ai-acceleration-good-for-new-orleans-by-jp-morrell/).
- [Screening AI use cases](https://fest.philosophers.group/p/the-most-valuable-ai-skill-is-saying-no-screening-ai-use-cases-for-real-return-by-dustin-t-hughes/).
- [Evidence and delivery](https://fest.philosophers.group/p/ai-made-us-faster-evidence-makes-us-confident-by-dustin-p-gaspard/).

The useful tension is between trying unusual things and deciding carefully where technology helps. Preserve that range in the campaign: an analog workshop needs its own appeal, a civic conversation needs its question, and a technical case study needs its concrete problem.

## Voice

Use a specific opening question, physical action, or practical problem. Name the speaker early. Describe what the published abstract supports. End with a clear invitation and the official program or registration link.

Keep the language warm, intelligent, direct, and occasionally playful. Short sentences suit the program's talk titles. Use humor when the subject supports it, rather than adding jokes to every session.

For analog sessions, describe the craft or experience. For technical sessions, describe what someone will build, investigate, or learn. For business sessions, describe the decision and its consequences. For civic sessions, describe the question and the people it affects.

Preserve claims as attributed talk topics. For example, “Why Machines Cannot Crochet” is a session title; the posting tool should not expand it into an independently verified scientific claim. The same rule applies to health, financial, educational, and model-performance claims in abstracts.

Avoid invented speaker quotes, endorsements, attendance figures, scarcity, or guaranteed outcomes. Public copy should identify the festival as the New Orleans Arts & Ideas Festival; NOAI can remain a familiar shorthand. The published program also describes a ceremonial burial of the NOAI brand, which makes final branding worth checking with organizers before producing a large asset set.

## Existing visual identity

Use the festival's established system as the starting point. The current public site already provides a coherent direction:

| Role | Observed token | Proposed use in the tool |
| --- | --- | --- |
| Paper | `#f3eddc` | Workspace background and poster ground |
| Surface | `#faf6ea` | Editing and reading surfaces |
| Ink | `#1a1a1a` | Main text, strong dividers |
| Blue | `#2250d6` | Primary actions and technical accents |
| Yellow | `#f4b714` | A limited highlight or large graphic area |
| Red | `#e0261e` | Graphic emphasis; use the darker text token for small text |
| Teal | `#1a9a9a` | Community and craft accents; use the darker text token for small text |
| Small red text | `#c41e17` | Text where the brighter red does not provide enough contrast |
| Small teal text | `#0f6e6e` | Text where the brighter teal does not provide enough contrast |
| Display type | Inter Tight, weights 500–900 | Talk titles and prominent controls |
| Body type | Inter, weights 400–700 | Copy, facts, labels, and review notes |
| Rules | 2px and 4px | Strong editorial structure |

The site also uses restrained paper grain, rings, and squiggles. Carry those motifs into reusable poster templates while keeping the organizer workspace legible. Use bold typographic compositions and supplied speaker photographs where appropriate. A text-only layout is a complete design for sessions without a photograph.

Do not manufacture speaker portraits or introduce a new festival logo. Do not bake readable talk details into generated artwork: titles, names, dates, and alt text belong to editable, exact templates.

## Proposed first build

Working tool title: **Arts & Ideas Dispatch**. This is a proposed product label, not an approved festival name.

User: a festival organizer preparing promotion for an already-published session.

Success: choose a current session, create an accurate platform-specific post and matching graphic, review the facts and account tags, and export an approved package. Measure preparation time against the organizer's existing workflow; no baseline or savings claim has been established.

### Approaches considered

| Approach | What it provides | Tradeoff |
| --- | --- | --- |
| Organizer drafting desk — recommended first milestone | Session selection, grounded drafts, graphics, source checks, editing, approval, and export | Useful before social credentials are available; publishing is a subsequent integration milestone |
| Publishing service immediately | The same workflow plus delivery to selected festival accounts | Requires named destination accounts, supported API access, and a tested delivery contract for each platform |
| Attendee discovery application | Suggested talks and personal itineraries | Serves a different primary user from the requested organizer promotion workflow |

### First milestone: drafting and review

1. Import the current official feed. Include only 2026 schedule rows. Keep the source snapshot, fetch time, and hash, and show the reader the source of every imported fact.
2. Present a searchable list grouped by day, with editorial theme filters visibly identified as our groupings. Select one session to view its title, speaker display, abstract, source link, and data issues.
3. Choose an output platform and an editorial angle: question, hands-on invitation, or practical example. Initial drafting formats cover LinkedIn, Instagram, Facebook, and X; this is a proposed output scope, not evidence that all festival accounts are connected.
4. Generate a draft using Claude once API access is established. Supply only the selected published session, permitted factual fields, approved profile identities, and the voice rules. Treat abstracts and imported HTML as data, not as tool instructions. Keep the API secret on the server. The exact model is configuration selected when the organizer's credits are confirmed.
5. Render deterministic factual details outside the model's creative text. Claude can propose an opening and a paraphrase; the application owns the speaker labels, approved date and venue, links, and permitted mention identities.
6. Show the post beside its source details and poster preview. Let the organizer edit text, choose a supplied photograph or text-only design, and write alt text. Missing profiles remain visibly unresolved.
7. Save a reviewed draft with its actor, source version, draft version, and channel. Export the text, graphic, alt text, source link, and review record. Any relevant edit invalidates the previous approval.

An offline demonstration may use hand-authored sample copy and must label that mode accurately. It must not simulate a Claude call or imply that a social account is connected.

### Proposed structure

A React frontend provides the program list and review workspace. A small server handles official-feed import, Claude generation, draft storage, and approval records. A Cloudflare Worker with D1 is the proposed deployment structure, consistent with the existing infrastructure context; this is a design choice, not an environment that has been created or tested.

Keep source import, editorial generation, factual validation, graphic rendering, approval, and delivery as separate units. Source and draft records receive stable IDs and versions. Social adapters are added only for named destination accounts after their actual capabilities are established.

The draft lifecycle is imported → drafted → needs review → approved → exported. An unresolved factual issue blocks approval for outputs that use that field. A source change sends affected drafts back to review. Exports record completion only after the package is produced.

### Second milestone: publishing

Select the actual festival accounts and implement one platform adapter at a time. A publish request references one approved draft version, one current source version, one destination account, and a unique delivery key. Re-check those versions before delivery. Record the returned remote post ID and URL, and preserve each destination's individual result if a multi-platform operation partly succeeds.

Do not automatically retry a delivery whose outcome is unknown. Resolve whether the destination accepted it first. Scheduling uses an explicit timezone and records UTC delivery timestamps. Publishing from this assistant session has not been requested, and no posts have been sent.

## Source issues the product must handle

Eight entries disagree between the public schedule and the linked presentation's scraped time. One of those also disagrees on the day. Neither source has been independently confirmed with the organizer, so these records must carry both values rather than silently resolving the discrepancy.

| Session | Public schedule | Presentation metadata |
| --- | --- | --- |
| Street chess and ice cream | Nov 11, 8:40 PM | Nov 12, 5:30 PM |
| E-Bike Conversion Speedrun | Nov 12, 3:45 PM | Nov 12, 4:00 PM |
| Designing an AI Literacy Course | Nov 12, 2:00 PM | Nov 12, 2:05 PM |
| Designing AI Agents Like Computer Systems | Nov 12, 2:30 PM | Nov 12, 2:40 PM |
| Temporal Mental Models | Nov 12, 3:00 PM | Nov 12, 3:15 PM |
| The Intentional Page | Nov 13, 1:00 PM | Nov 13, 3:30 PM |
| The Most Valuable AI Skill Is Saying No | Nov 13, 2:30 PM | Nov 13, 1:00 PM |
| Explain It | Nov 13, 3:45 PM | Nov 13, 2:15 PM |

These are verified disagreements in the data, not proof of which time is correct. A broad subject-focused post can omit the conflicting fields, with that omission visible to the reviewer. A timed announcement requires organizer confirmation and a recorded resolution.

Additional issues:

- The feed does not declare an event timezone. America/Chicago is inferred from the New Orleans venue and is the proposed configuration; confirm it before scheduling.
- The current presentation fields contain no social profile fields. Separately supplied, unverified profile candidates need explicit association with the published session; their private submission provenance is unavailable in this public repository.
- Joseph Makkos's submission has `https://noai.fyi` in its X field. That is not an X profile URL.
- Rob Gaudet's submission has an Instagram URL in its Facebook field. Platform labels alone are not sufficient.
- Mason Mitchell's supplied LinkedIn URL is `/feed/`, not an individual profile.
- The Ella Project submission supplies organizational accounts. Do not present an organizational tag as Gene Meneray's personal identity.
- Fourteen entries lack an explicit format; use a generic “session” label until resolved.
- Six entries lack a linked abstract; draft from their published schedule facts rather than inventing a description.

## Sample copy for reviewing the direction

These are hand-authored proposals. They have not been approved, posted, or generated through Claude. They omit native tags because profile identities have not been validated, and they omit exact session times.

**Letterpress / Instagram or Facebook**

Before the prompt, there was movable type.

Joseph Makkos leads a hands-on letterpress workshop at the New Orleans Arts & Ideas Festival. Work with type and ink, and leave with a print of your own.

November 12 at the Jazz Museum. Explore the program: https://fest.philosophers.group/

**Creative experiment / LinkedIn**

What happens when you treat technology as a creative medium?

Cam'ron Caldwell brings “Nobody Asked for This” to the New Orleans Arts & Ideas Festival: a conversation about curiosity, unusual projects, and finding the purpose as you make something.

Join us November 11 at the Jazz Museum. Explore the program: https://fest.philosophers.group/

**Useful restraint / LinkedIn**

Which AI project is actually worth doing?

Dustin T. Hughes leads a workshop on screening use cases against the real work they could save. A practical session for choosing where to spend your effort.

Part of the New Orleans Arts & Ideas Festival, November 11–13 at the Jazz Museum. Explore the program: https://fest.philosophers.group/

The three examples demonstrate different openings and a consistent factual finish. A platform-specific version still needs its own length, link treatment, image format, and account review.

## Implementation acceptance checks

The following checks are proposed for the eventual build and have not run:

1. Import exactly the 48 current 2026 rows from this snapshot; exclude the archive and unscheduled submissions.
2. Preserve source dates and times and flag the eight time disagreements plus the additional day disagreement.
3. A timed draft for an unresolved record cannot be approved. A draft deliberately omitting disputed fields shows that choice to the reviewer.
4. Reject the observed wrong-platform and generic-feed URLs as automatic tag candidates. Missing native identity resolution prevents a native mention.
5. Changing a source fact, draft text, graphic, alt text, tag, or destination invalidates the corresponding approval.
6. A malformed model response or unavailable provider preserves the current draft and shows a useful error.
7. Every exported package identifies the session, source version, draft version, platform, copy, graphic, alt text, and review actor.
8. The list → session → draft → edit → approve → export flow works at phone and desktop widths, including keyboard navigation and readable poster text.
9. Each future delivery adapter proves single delivery, known failure, uncertain outcome, and partial multi-platform success against its actual API.

## Current state and next decision

Completed: program research, interpretation of mood and themes, observed brand-token extraction, source-consistency review, sample editorial copy, and a factual inventory suitable for importing into the build.

Proposed: the drafting desk, architecture, validation rules, export package, and later delivery adapters.

Not implemented or tested: an application, Claude generation, social account connections, publishing, or deployment.

The design decision for review is the organizer drafting desk as the first milestone, using the existing festival visual identity and the source checks above. The actual festival accounts and the form of Anthropic credits remain unknown. Those facts are necessary for live provider and publishing integration, but not for building the draft-and-review workspace after design approval.
