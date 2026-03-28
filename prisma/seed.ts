import "./load-env";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma } from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";
import { SessionType, UserRole } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required when running prisma/seed.ts");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type TemplateSeed = {
  slug: string;
  title: string;
  description: string;
  sessionType: (typeof SessionType)[keyof typeof SessionType];
  sortOrder: number;
};

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    slug: "clinical-intake-dialogue",
    title: "Clinical intake dialogue",
    description: "Guided practice for client intake vocabulary and tone.",
    sessionType: SessionType.GUIDED_DIALOGUE,
    sortOrder: 10,
  },
  {
    slug: "surgery-consent-role-play",
    title: "Surgery consent role-play",
    description: "Role-play explaining procedures and risks clearly.",
    sessionType: SessionType.ROLE_PLAY,
    sortOrder: 20,
  },
  {
    slug: "terminology-quick-drill",
    title: "Terminology quick drill",
    description: "Short vocabulary drills for common lab and imaging terms.",
    sessionType: SessionType.VOCABULARY_DRILL,
    sortOrder: 30,
  },
  {
    slug: "case-chart-review",
    title: "Case chart review",
    description: "Structured review of SOAP-style notes and follow-up language.",
    sessionType: SessionType.CASE_REVIEW,
    sortOrder: 40,
  },
];

type QuestionSeed = {
  ordinal: number;
  promptText: string;
  helpText?: string;
  expectedDurationSec?: number;
  isRequired: boolean;
};

type UserSeed = {
  email: string;
  name: string;
  role: (typeof UserRole)[keyof typeof UserRole];
};

const DEFAULT_SEED_PASSWORD = "12345678";

const ADDITIONAL_USER_SEEDS: UserSeed[] = [
  {
    email: "owner@vet-training.local",
    name: "Program Owner",
    role: UserRole.PRODUCT_OWNER,
  },
  {
    email: "teacher1@vet-training.local",
    name: "Teacher One",
    role: UserRole.USER,
  },
  {
    email: "teacher2@vet-training.local",
    name: "Teacher Two",
    role: UserRole.USER,
  },
  {
    email: "teacher3@vet-training.local",
    name: "Teacher Three",
    role: UserRole.USER,
  },
  {
    email: "teacher4@vet-training.local",
    name: "Teacher Four",
    role: UserRole.USER,
  },
  {
    email: "student1@vet-training.local",
    name: "Vet Student One",
    role: UserRole.USER,
  },
  {
    email: "student2@vet-training.local",
    name: "Vet Student Two",
    role: UserRole.USER,
  },
  {
    email: "student3@vet-training.local",
    name: "Vet Student Three",
    role: UserRole.USER,
  },
  {
    email: "student4@vet-training.local",
    name: "Vet Student Four",
    role: UserRole.USER,
  },
  {
    email: "student5@vet-training.local",
    name: "Vet Student Five",
    role: UserRole.USER,
  },
];

/** Ordered questions per template slug — idempotent upserts by (templateId, ordinal). */
const TEMPLATE_QUESTIONS: Record<string, QuestionSeed[]> = {
  "clinical-intake-dialogue": [
    {
      ordinal: 1,
      promptText:
        "A client brings in a dog with acute vomiting. How do you open the intake, ask about diet and duration, and set a professional, empathetic tone?",
      helpText: "Speak as you would in an exam room. Aim for 45–90 seconds.",
      expectedDurationSec: 90,
      isRequired: true,
    },
    {
      ordinal: 2,
      promptText:
        "The owner is worried about cost. How do you explain next diagnostic steps without overwhelming them?",
      helpText: "Focus on clarity and shared decision-making.",
      expectedDurationSec: 90,
      isRequired: true,
    },
    {
      ordinal: 3,
      promptText: "Summarize the plan and follow-up in two or three sentences for the client.",
      helpText: "Close with a clear timeline and when to call the clinic.",
      expectedDurationSec: 60,
      isRequired: true,
    },
  ],
  "surgery-consent-role-play": [
    {
      ordinal: 1,
      promptText:
        "Explain routine ovariohysterectomy at a high level: what the procedure involves and why it is recommended in this case.",
      helpText: "Avoid jargon; offer to define terms if needed.",
      expectedDurationSec: 90,
      isRequired: true,
    },
    {
      ordinal: 2,
      promptText: "Discuss anesthesia risks and monitoring in plain language for a worried owner.",
      expectedDurationSec: 90,
      isRequired: true,
    },
    {
      ordinal: 3,
      promptText:
        "Confirm informed consent: invite questions and restate post-operative care and emergency signs.",
      expectedDurationSec: 90,
      isRequired: true,
    },
  ],
  "terminology-quick-drill": [
    {
      ordinal: 1,
      promptText: "Define CBC and explain one reason we might run it before anesthesia.",
      expectedDurationSec: 60,
      isRequired: true,
    },
    {
      ordinal: 2,
      promptText: "Explain what a chemistry panel tells us about organ function in one short paragraph.",
      expectedDurationSec: 60,
      isRequired: true,
    },
    {
      ordinal: 3,
      promptText: "Describe radiographs versus ultrasound to a client in simple terms.",
      expectedDurationSec: 60,
      isRequired: true,
    },
  ],
  "case-chart-review": [
    {
      ordinal: 1,
      promptText: "Read the following scenario: a cat with PU/PD and weight loss. State your differential list in spoken form.",
      helpText: "Mention at least three differentials and why they matter.",
      expectedDurationSec: 120,
      isRequired: true,
    },
    {
      ordinal: 2,
      promptText: "Outline a SOAP-style plan: subjective, objective, assessment, and plan for the next visit.",
      expectedDurationSec: 120,
      isRequired: true,
    },
    {
      ordinal: 3,
      promptText: "How would you document owner communication and consent in the record?",
      expectedDurationSec: 60,
      isRequired: true,
    },
  ],
};

async function seedDeveloperUser(): Promise<void> {
  const email = process.env.DEV_USER_EMAIL?.trim();
  const password = process.env.DEV_USER_PASSWORD;

  if (!email || !password) {
    console.log("[seed] SKIP: protected developer — DEV_USER_EMAIL and DEV_USER_PASSWORD not both set.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      name: "Protected Developer",
      role: UserRole.DEVELOPER,
      isProtectedAccount: true,
      isActive: true,
    },
    update: {
      passwordHash,
      name: "Protected Developer",
      role: UserRole.DEVELOPER,
      isProtectedAccount: true,
      isActive: true,
    },
  });

  console.log(
    `[seed] ${existing ? "UPDATED" : "CREATED"}: protected developer user (${email}, role=DEVELOPER, isProtectedAccount=true, isActive=true)`,
  );
}

async function seedAdditionalUsers(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 12);

  for (const userSeed of ADDITIONAL_USER_SEEDS) {
    const existing = await prisma.user.findUnique({ where: { email: userSeed.email } });

    await prisma.user.upsert({
      where: { email: userSeed.email },
      create: {
        email: userSeed.email,
        passwordHash,
        name: userSeed.name,
        role: userSeed.role,
        isProtectedAccount: false,
        isActive: true,
      },
      update: {
        passwordHash,
        name: userSeed.name,
        role: userSeed.role,
        isProtectedAccount: false,
        isActive: true,
      },
    });

    console.log(
      `[seed] ${existing ? "UPDATED" : "CREATED"}: user (${userSeed.email}, role=${userSeed.role}, password=${DEFAULT_SEED_PASSWORD})`,
    );
  }
}

async function seedSessionTemplates(): Promise<void> {
  for (const t of TEMPLATE_SEEDS) {
    const before = await prisma.sessionTemplate.findUnique({ where: { slug: t.slug } });

    await prisma.sessionTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        title: t.title,
        description: t.description,
        sessionType: t.sessionType,
        published: true,
        sortOrder: t.sortOrder,
        configJson: Prisma.JsonNull,
      },
      update: {
        title: t.title,
        description: t.description,
        sessionType: t.sessionType,
        published: true,
        sortOrder: t.sortOrder,
        configJson: Prisma.JsonNull,
      },
    });

    const template = await prisma.sessionTemplate.findUniqueOrThrow({ where: { slug: t.slug } });
    const qdefs = TEMPLATE_QUESTIONS[t.slug] ?? [];

    for (const q of qdefs) {
      await prisma.sessionTemplateQuestion.upsert({
        where: {
          templateId_ordinal: {
            templateId: template.id,
            ordinal: q.ordinal,
          },
        },
        create: {
          templateId: template.id,
          ordinal: q.ordinal,
          promptText: q.promptText,
          helpText: q.helpText ?? null,
          expectedDurationSec: q.expectedDurationSec ?? null,
          isRequired: q.isRequired,
        },
        update: {
          promptText: q.promptText,
          helpText: q.helpText ?? null,
          expectedDurationSec: q.expectedDurationSec ?? null,
          isRequired: q.isRequired,
        },
      });
    }

    console.log(
      `[seed] ${before ? "ENSURED (updated)" : "CREATED"}: session template slug=${t.slug} title="${t.title}" (${qdefs.length} questions)`,
    );
  }
}

async function main(): Promise<void> {
  console.log("[seed] Starting vet-training-aleph seed…");
  await seedDeveloperUser();
  await seedAdditionalUsers();
  await seedSessionTemplates();
  console.log("[seed] Done.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seed] FAILED:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
