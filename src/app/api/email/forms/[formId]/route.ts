import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * OPTIONS /api/email/forms/[formId]
 * CORS preflight handler
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/email/forms/[formId]
 * Returns form configuration as JSON for embedding (public, no auth)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { formId: string } },
) {
  try {
    const { formId } = params;

    const form = await db.signupForm.findUnique({
      where: { id: formId },
    });

    if (!form || !form.isActive) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        id: form.id,
        name: form.name,
        fields: form.fields,
        buttonText: form.buttonText,
        successMsg: form.successMsg,
        description: form.description,
        brandColor: form.brandColor,
        style: form.style,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

/**
 * POST /api/email/forms/[formId]
 * Submit a signup form (public, no auth)
 * Creates an EmailContact in the form's linked list and auto-enrolls in WELCOME automations
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { formId: string } },
) {
  try {
    const { formId } = params;

    let body: { email?: string; firstName?: string; lastName?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const { email, firstName, lastName } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Look up form
    const form = await db.signupForm.findUnique({
      where: { id: formId },
      include: { list: true },
    });

    if (!form || !form.isActive) {
      return NextResponse.json(
        { error: 'Form not found' },
        { status: 404, headers: CORS_HEADERS },
      );
    }

    // Check if contact already exists in this list (unique constraint: listId + email)
    const existing = await db.emailContact.findUnique({
      where: { listId_email: { listId: form.listId, email: email.toLowerCase() } },
    });

    if (existing) {
      // Skip creation but still return success
      return NextResponse.json(
        { success: true, message: form.successMsg },
        { headers: CORS_HEADERS },
      );
    }

    // Create contact
    const contact = await db.emailContact.create({
      data: {
        listId: form.listId,
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        consentedAt: new Date(),
        consentSource: `signup_form:${formId}`,
        status: 'ACTIVE',
      },
    });

    // Increment form submissions
    await db.signupForm.update({
      where: { id: formId },
      data: { submissions: { increment: 1 } },
    });

    // Update list contact count
    const activeCount = await db.emailContact.count({
      where: { listId: form.listId, status: 'ACTIVE' },
    });
    await db.emailList.update({
      where: { id: form.listId },
      data: { contactCount: activeCount },
    });

    // Auto-enroll in WELCOME automations for this bot
    // Find active WELCOME automations where triggerListId matches or is null
    const welcomeAutomations = await db.emailAutomation.findMany({
      where: {
        botId: form.botId,
        type: 'WELCOME',
        isActive: true,
        OR: [
          { triggerListId: form.listId },
          { triggerListId: null },
        ],
      },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          take: 1,
        },
      },
    });

    for (const automation of welcomeAutomations) {
      // Calculate when the first step should fire
      let nextStepAt: Date | null = null;
      if (automation.steps.length > 0) {
        const firstStep = automation.steps[0];
        const delayMs =
          (firstStep.delayDays * 24 * 60 * 60 * 1000) +
          (firstStep.delayHours * 60 * 60 * 1000);
        nextStepAt = new Date(Date.now() + delayMs);
      }

      try {
        await db.automationEnrollment.create({
          data: {
            automationId: automation.id,
            contactId: contact.id,
            currentStep: 0,
            completed: false,
            cancelled: false,
            nextStepAt,
          },
        });
      } catch (enrollError) {
        // Skip if already enrolled (unique constraint: automationId + contactId)
        if (
          enrollError instanceof Error &&
          enrollError.message.includes('Unique constraint')
        ) {
          continue;
        }
        // Log but don't fail the submission for enrollment errors
      }
    }

    return NextResponse.json(
      { success: true, message: form.successMsg },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
