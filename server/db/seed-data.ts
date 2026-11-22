import { taxonomyDefaults } from "./taxonomy-defaults";
import { saturdaySessions } from "@/lib/dates/saturday-schedule";
import type { DataState } from "@/lib/types";
import {
  defaultSettings,
  SECTORS,
  STAGES,
  TEAM_SIZES,
  FUNCTIONS,
  NEEDS,
  RELATIONS,
  OPPORTUNITY_TYPES,
  PIPELINE,
  RESEARCH_SECTIONS,
  ROLES,
} from "@/lib/catalog";
const at = (month: number, day: number, hour = 16) =>
  new Date(Date.UTC(2026, month - 1, day, hour)).toISOString();
const names = [
  "Amara Okafor",
  "Tomi Adebayo",
  "Zainab Bello",
  "Kofi Mensah",
  "Nia Wanjiku",
  "Thabo Molefe",
  "Ada Nwosu",
  "Yusuf Sule",
  "Maya Boateng",
  "Chidi Eze",
  "Aisha Diallo",
  "Lerato Dlamini",
  "Tunde Balogun",
  "Fatima Abdi",
  "Kwame Owusu",
  "Imani Mwangi",
  "Seyi Adeyemi",
  "Nandi Nkosi",
  "Emeka Obi",
  "Halima Hassan",
  "Kojo Asante",
  "Wanjiru Kamau",
  "Bola Akinwale",
  "Samira Benali",
  "Uche Nnamdi",
  "Ngozi Ibe",
  "Ayo Bakare",
  "Tariro Moyo",
  "Esi Osei",
  "Damilola Cole",
  "Ife Nwankwo",
  "Chiamaka Udo",
  "Sibusiso Dube",
  "Zuri Otieno",
  "Ibrahim Sani",
  "Leila Haddad",
  "Olamide George",
  "Abena Appiah",
  "Dineo Khumalo",
  "Femi Alabi",
  "Mira Shah",
  "Lucas Costa",
  "Sofia Martins",
  "Arjun Rao",
  "Elena Popov",
  "Daniel Park",
  "Amina Farouk",
  "Priya Sen",
  "Noah Williams",
  "Isabel Cruz",
];
const companyNames = [
  "KoraLane",
  "ClearMint",
  "Sable ID",
  "RoutePay",
  "Nuru Labs",
  "VaultSpring",
  "OrbitPass",
  "OpenCurrent",
  "Canopy Chain",
  "MintBridge",
  "FolioMesh",
  "TideLedger",
  "Aster Protocol",
  "RootKey",
  "PrismRails",
  "Cedar Finance",
  "Loom Network",
  "Pebble Data",
  "RiverStack",
  "Solaris Guild",
  "Northstar ID",
  "Patchwork",
  "Acacia Pay",
  "SignalNest",
  "EchoVault",
  "BloomKeys",
  "Harbor Labs",
  "Mosaic Web",
  "Trellis",
  "CopperNode",
  "Palm Protocol",
  "Slate Capital",
  "Drift Studio",
  "Kite Finance",
  "Sage Relay",
  "AtlasWorks",
  "NovaMint",
  "Acorn ID",
  "Ridge Labs",
  "FlowMark",
  "LotusFi",
  "PortaStack",
  "Meridian",
  "Indigo Labs",
  "Glyph Network",
  "Daylight",
  "Dune Studio",
  "PaperChain",
  "Fern Systems",
  "RelayOne",
];
const countries = [
  "Nigeria",
  "Nigeria",
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "Nigeria",
  "Nigeria",
  "Ghana",
  "Nigeria",
  "Senegal",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Kenya",
  "Nigeria",
  "South Africa",
  "Nigeria",
  "Nigeria",
  "Ghana",
  "Kenya",
  "Nigeria",
  "Morocco",
  "Nigeria",
  "Nigeria",
  "Nigeria",
  "Zimbabwe",
  "Ghana",
  "Nigeria",
  "Nigeria",
  "Nigeria",
  "South Africa",
  "Kenya",
  "Nigeria",
  "Egypt",
  "Nigeria",
  "Ghana",
  "South Africa",
  "Nigeria",
  "India",
  "Brazil",
  "Portugal",
  "India",
  "Germany",
  "United States of America",
  "Egypt",
  "India",
  "United Kingdom",
  "Mexico",
];
export function makeSeed(): DataState {
  const s: DataState = {
    version: 1,
    fictional: true,
    founders: [],
    companies: [],
    memberships: [],
    applications: [],
    sessions: [],
    participants: [],
    spaceData: [],
    spaceAttendance: [],
    bookings: [],
    research: [],
    answers: [],
    labels: [],
    companyLabels: [],
    needs: [],
    relationships: [],
    opportunities: [],
    activities: [],
    campaigns: [],
    campaignParticipants: [],
    awards: [],
    audit: [],
    users: [],
    invitations: [],
    settings: { ...defaultSettings },
  };
  names.forEach((name, i) => {
    const f = `f${i + 1}`,
      c = `c${i + 1}`,
      createdAt = at(i < 18 ? 9 : i < 37 ? 10 : 11, (i % 18) + 1);
    s.founders.push({
      id: f,
      name,
      role: i % 7 ? "Co-founder & CEO" : "Technical co-founder",
      xHandle: `${name.split(" ")[0].toLowerCase()}_fl_demo${i}`,
      contact: `founder${i + 1}@example.invalid`,
      country: countries[i],
      relationshipStatus: i < 35 ? "Interviewed" : "New",
      source: "Fictional programme seed",
      verification: i % 3 ? "Self-reported" : "Evidence reviewed",
      notes: "Fictional research participant, not a real individual.",
      followUp:
        i % 4
          ? "Share the next research brief"
          : "Schedule a product walkthrough",
      createdAt,
      updatedAt: createdAt,
    });
    const hiring = i % 8 === 0;
    s.companies.push({
      id: c,
      name: companyNames[i],
      description: `${companyNames[i]} is a fictional ${SECTORS[i % 10].toLowerCase()} product helping small businesses and Web3 teams simplify everyday work.`,
      website: `https://project${i + 1}.example.invalid`,
      country: countries[i],
      operatingCountries: [
        countries[i],
        ...(i % 4 === 0 ? ["Kenya", "Ghana"] : []),
      ].filter((v, j, a) => a.indexOf(v) === j),
      teamSize: TEAM_SIZES[i % 5],
      stage: STAGES[1 + (i % 5)],
      sector: SECTORS[i % 10],
      economicFunctions: [
        FUNCTIONS[i % 10],
        ...(i % 3 === 0 ? ["Analytics"] : []),
      ],
      customers: [i % 2 ? "Small businesses" : "Web3 teams"],
      businessModels: [i % 3 ? "Subscription" : "Usage based"],
      ecosystems: [["Ethereum", "Solana", "Base", "Multichain"][i % 4]],
      chains: [["Ethereum", "Solana", "Base", "Polygon"][i % 4]],
      integrations: i % 3 ? ["Wallet connection", "Analytics SDK"] : [],
      distribution: [
        [
          "Community",
          "Partnerships",
          "Developer content",
          "Direct sales",
          "Referrals",
        ][i % 5],
      ],
      hiringStatus: hiring ? "Hiring" : "Unknown",
      hiringEvidence: hiring
        ? "Fictional founder interview: actively seeking a TypeScript engineer."
        : "",
      challenges:
        NEEDS[i % NEEDS.length] +
        ": limited internal capacity and uncertain acquisition costs.",
      createdAt,
      updatedAt: createdAt,
    });
    s.memberships.push({
      founderId: f,
      companyId: c,
      role: "Co-founder",
      createdAt,
    });
    s.applications.push({
      id: `a${i + 1}`,
      reference: `FL-DEMO-${String(i + 1).padStart(3, "0")}`,
      founderName: name,
      companyName: companyNames[i],
      xHandle: s.founders[i].xHandle,
      website: s.companies[i].website,
      country: countries[i],
      description: s.companies[i].description,
      speakers: 1 + (i % 3),
      teamSize: s.companies[i].teamSize,
      stage: s.companies[i].stage,
      sector: s.companies[i].sector,
      focus: "Build useful products for underserved customers",
      founderRole: s.founders[i].role,
      contact: s.founders[i].contact,
      teamCountries: [countries[i]],
      ecosystem: s.companies[i].ecosystems[0],
      hiring,
      seeking: NEEDS[i % NEEDS.length],
      comments: "Fictional application for the walkthrough.",
      privacyConsent: true,
      promotionalConsent: i % 4 === 0,
      status:
        i < 40
          ? "Approved"
          : i < 46
            ? "Pending"
            : i < 48
              ? "Waitlisted"
              : "Declined",
      founderId: f,
      companyId: c,
      createdAt,
      updatedAt: createdAt,
    });
    s.needs.push({
      id: `n${i + 1}`,
      companyId: c,
      kind: hiring ? "Hiring" : NEEDS[i % NEEDS.length],
      description: hiring
        ? "A TypeScript engineer to improve the onboarding experience."
        : `Support with ${NEEDS[i % NEEDS.length].toLowerCase()} during the next quarter.`,
      evidence: `Fictional founder self-report in application FL-DEMO-${String(i + 1).padStart(3, "0")}.`,
      confidence: i % 3 ? "Medium" : "High",
      verification: "Self-reported",
      createdAt,
      updatedAt: createdAt,
    });
  });
  // Multiple founders can work at one company; a founder may also build a second company.
  s.memberships.push(
    { founderId: "f2", companyId: "c1", role: "Advisor", createdAt: at(10, 2) },
    {
      founderId: "f1",
      companyId: "c4",
      role: "Co-founder",
      createdAt: at(10, 3),
    },
    {
      founderId: "f5",
      companyId: "c6",
      role: "Co-founder",
      createdAt: at(10, 4),
    },
  );
  for (let i = 0; i < 10; i++) {
    const id = `s${i + 1}`,
      day = 3 + i * 4;
    s.sessions.push({
      id,
      title:
        [
          "Building useful rails",
          "From insight to adoption",
          "The trust layer",
          "Distribution that compounds",
          "Founders in the field",
        ][i % 5] + ` · ${i + 1}`,
      startsAt: at(10, day, 17),
      timezone: "UTC",
      host: "Ola_Crrypt",
      capacity: 5,
      deadline: at(10, day - 1),
      status: "Completed",
      researchStatus: i < 7 ? "Complete" : "In progress",
      liveUrl: `https://spaces.example.invalid/live/${id}`,
      postUrl: "",
      recordingUrl: `https://spaces.example.invalid/recording/${id}`,
      notes: "Fictional completed interview session.",
      createdAt: at(9, 25),
      updatedAt: at(11, 15),
    });
    for (let j = 0; j < 4; j++) {
      const k = (i * 4 + j) % 40,
        founderId = `f${k + 1}`,
        companyId = `c${k + 1}`;
      s.participants.push({
        id: `p${i}-${j}`,
        sessionId: id,
        founderId,
        companyId,
        speakers: 1 + (k % 3),
        attendance: j === 3 && i % 3 === 0 ? "No-show" : "Attended",
        createdAt: at(10, day - 2),
      });
      s.bookings.push({
        id: `b${i}-${j}`,
        applicationId: `a${k + 1}`,
        sessionId: id,
        speakers: 1 + (k % 3),
        status: j === 3 && i % 3 === 0 ? "No-show" : "Attended",
        createdAt: at(10, day - 2),
        updatedAt: at(10, day),
      });
      if (j === 3 && i % 3 === 0) continue;
      const rid = `r${i}-${j}`;
      s.research.push({
        id: rid,
        founderId,
        companyId,
        sessionId: id,
        researcher: i % 2 ? "Maya · Research" : "Ola_Crrypt",
        recordedAt: at(10, day),
        evidence: `Fictional interview notes, session ${i + 1}. Recording is a placeholder.`,
        confidence: "Medium",
        verification: k % 9 === 0 ? "Evidence reviewed" : "Self-reported",
        visibility: k % 9 === 0 ? "Public" : "Private",
        status: i < 7 ? "Complete" : "Draft",
        createdAt: at(10, day),
        updatedAt: at(11, 15),
      });
      RESEARCH_SECTIONS.forEach((section, q) =>
        s.answers.push({
          id: `ans-${rid}-${q}`,
          researchId: rid,
          section,
          response:
            q === 6
              ? s.companies[k].challenges
              : q === 7
                ? s.companies[k].hiringEvidence ||
                  "Team is not making an explicit hiring claim."
                : q === 3
                  ? "Community referrals bring early users; repeat activation is not yet measured."
                  : q === 5
                    ? "Founder reviews onboarding events in a spreadsheet; cohort-level retention is missing."
                    : q === 8
                      ? "An integration with a complementary onboarding or analytics product could reduce manual work."
                      : `${s.founders[k].name} described the ${section.toLowerCase()} of ${s.companies[k].name}. This is fictional, self-reported evidence.`,
          classification:
            q === 3 ? "Community" : q === 5 ? "Basic analytics" : "",
        }),
      );
    }
  }
  for (let i = 0; i < 4; i++)
    s.sessions.push({
      id: `up${i + 1}`,
      title: [
        "Founder Saturday: product & people",
        "Making Web3 useful",
        "A founder’s distribution playbook",
        "What teams need next",
      ][i],
      startsAt: at(12, 5 + i * 7, 19),
      timezone: "UTC",
      host: "Ola_Crrypt",
      capacity: 5,
      deadline: at(12, 4 + i * 7, 19),
      status: "Scheduled",
      researchStatus: "Not started",
      liveUrl: "",
      postUrl: "",
      recordingUrl: "",
      notes: "",
      createdAt: at(11, 15),
      updatedAt: at(11, 15),
    });
  for (const slot of saturdaySessions(new Date("2026-11-22T00:00:00Z"))) {
    if (
      s.sessions.some(
        (session) =>
          session.startsAt.slice(0, 10) ===
          slot.startsAt.toISOString().slice(0, 10),
      )
    )
      continue;
    s.sessions.push({
      ...slot,
      id: `demo-${slot.id}`,
      startsAt: slot.startsAt.toISOString(),
      deadline: slot.deadline.toISOString(),
      createdAt: at(11, 15),
      updatedAt: at(11, 15),
    });
  }
  for (let i = 0; i < 6; i++)
    s.bookings.push({
      id: `pending${i}`,
      applicationId: `a${41 + i}`,
      sessionId: i < 4 ? "up1" : "up2",
      speakers: 1 + (i % 3),
      status: i === 5 ? "Waitlisted" : "Pending",
      createdAt: at(11, 18),
      updatedAt: at(11, 18),
    });
  RELATIONS.forEach((type, i) =>
    s.relationships.push({
      id: `rel${i}`,
      companyAId: `c${i + 1}`,
      companyBId: `c${i + 12}`,
      type,
      reason:
        type === "Direct competitor"
          ? "Both explicitly target the same small-business payment workflow with similar buyer budgets."
          : type === "Potential integration"
            ? "A consented identity check could plug into the partner onboarding flow."
            : "The documented customer workflow suggests a complementary route to market.",
      evidence:
        "Fictional researcher comparison of the two product descriptions; validate with founders.",
      confidence: "Medium",
      researcher: "Maya · Research",
      verification: i < 2 ? "Evidence reviewed" : "Unverified",
      reviewedAt: at(11, 17),
      createdAt: at(11, 16),
      updatedAt: at(11, 17),
    }),
  );
  for (let i = 0; i < 22; i++) {
    const k = i % 50;
    s.opportunities.push({
      id: `o${i + 1}`,
      companyId: `c${k + 1}`,
      founderId: `f${k + 1}`,
      needId: `n${k + 1}`,
      category: OPPORTUNITY_TYPES[i % 11],
      solution: [
        "Map activation events and build a weekly cohort dashboard",
        "Introduce a complementary onboarding provider",
        "Explore a scoped discovery workshop",
      ][i % 3],
      skills: ["Research", "TypeScript", "Data analytics"].slice(
        0,
        1 + (i % 3),
      ),
      decisionMaker: names[k],
      budget: i % 4 ? "Unknown" : "Indicative $1,000–$3,000 · unconfirmed",
      evidence:
        "Fictional self-reported need; commercial interest is not a signed agreement.",
      owner: i % 2 ? "Ola_Crrypt" : "Maya",
      nextAction:
        i % 3
          ? "Validate scope and timing with the founder"
          : "Ask for a short discovery call",
      followUpDate: at(12, 1 + (i % 14)),
      status: PIPELINE[i % 10],
      outcome:
        i % 10 === 7
          ? "Fictional pilot agreed"
          : i % 10 === 8
            ? "Timing did not align"
            : "",
      createdAt: at(11, 1 + (i % 15)),
      updatedAt: at(11, 18),
    });
    s.activities.push({
      id: `oa${i}`,
      opportunityId: `o${i + 1}`,
      actor: "Maya",
      note: "Opportunity hypothesis recorded from structured founder notes.",
      createdAt: at(11, 18),
    });
  }
  s.labels.push(...taxonomyDefaults());
  s.companies.forEach((c) =>
    s.labels
      .filter(
        (l) =>
          (l.group === "Sector" && l.name === c.sector) ||
          (l.group === "Economic function" &&
            c.economicFunctions.includes(l.name)),
      )
      .forEach((l) => s.companyLabels.push({ companyId: c.id, labelId: l.id })),
  );
  ["2026-10", "2026-11"].forEach((period, i) => {
    const id = `campaign${i + 1}`;
    s.campaigns.push({
      id,
      name: i ? "November founder cohort" : "October founder cohort",
      period,
      target: 20,
      awardAmount: "1 SOL",
      rules: defaultSettings.terms,
      criteria:
        "Clarity of customer problem, evidence of progress, founder learning and contribution. Disclose reviewer conflicts.",
      status: i ? "Open" : "Closed",
      createdAt: at(i ? 11 : 10, 1),
      updatedAt: at(11, 15),
    });
    for (let j = 0; j < 20; j++)
      s.campaignParticipants.push({
        campaignId: id,
        founderId: `f${i * 20 + j + 1}`,
        eligible: j < 17,
        assessment:
          j < 10
            ? "Eligibility checked against the fictional programme rules."
            : "",
        reviewer: j < 10 ? "Ola_Crrypt" : "",
      });
  });
  s.awards.push({
    id: "award1",
    campaignId: "campaign1",
    founderId: "f1",
    reviewer: "Ola_Crrypt",
    rationale:
      "Fictional assessment: clear customer problem and documented product progress; no reviewer conflict recorded.",
    decisionDate: at(11, 2),
    status: "Selected",
    transactionReference: "",
    createdAt: at(11, 2),
    updatedAt: at(11, 2),
  });
  Object.entries(ROLES).forEach(([id, role], i) =>
    s.users.push({
      id: `demo-user-${id}`,
      name: i === 0 ? "Ola_Crrypt" : `${role.name} preview`,
      email: `${id}@example.invalid`,
      roleId: id,
      active: true,
      permissions: role.permissions,
    }),
  );
  s.audit.push({
    id: "audit-seed",
    actor: "System",
    action: "Demo initialised",
    entityId: "demo",
    detail: "50 fictional founders. No real private data.",
    createdAt: at(11, 20),
  });
  return s;
}
