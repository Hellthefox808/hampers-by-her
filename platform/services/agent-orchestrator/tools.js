/**
 * Hampers by Her Atelier AI Platform — GTM Tools & Confirmation Gate Matrix
 * Partitioned into SAFE_READ (auto) and DESTRUCTIVE_WRITE (confirmation required).
 */

const CONFIRMATION_REQUIRED_TOOLS = new Set([
  "create_lead",
  "update_deal_stage",
  "send_outreach_email",
  "delete_lead"
]);

const TOOLS_SCHEMA = [
  {
    name: "get_leads",
    description: "Search and retrieve leads within the tenant scope. SAFE_READ.",
    riskTier: "SAFE_READ",
    requiresConfirmation: false,
    parameters: {
      filter: { type: "string", description: "Optional name or company filter" },
      limit: { type: "number", description: "Max leads to return" }
    }
  },
  {
    name: "get_deal_pipeline",
    description: "Retrieve pipeline metrics and deals within tenant scope. SAFE_READ.",
    riskTier: "SAFE_READ",
    requiresConfirmation: false,
    parameters: {
      stage: { type: "string", description: "Optional stage name" }
    }
  },
  {
    name: "create_lead",
    description: "Create a new lead in the CRM. DESTRUCTIVE_WRITE: Requires user confirmation.",
    riskTier: "DESTRUCTIVE_WRITE",
    requiresConfirmation: true,
    parameters: {
      name: { type: "string", required: true },
      email: { type: "string", required: true },
      company: { type: "string", required: true }
    }
  },
  {
    name: "update_deal_stage",
    description: "Transition a deal to a new stage. DESTRUCTIVE_WRITE: Requires user confirmation.",
    riskTier: "DESTRUCTIVE_WRITE",
    requiresConfirmation: true,
    parameters: {
      dealId: { type: "string", required: true },
      newStage: { type: "string", required: true }
    }
  }
];

class ToolExecutor {
  constructor({ dbClient, outbox } = {}) {
    this.dbClient = dbClient;
    this.outbox = outbox;
  }

  /**
   * Execute a tool under strict authorization and confirmation checks
   */
  async execute({ toolName, arguments: args, tenantId, userId, approved = false }) {
    if (!tenantId) throw new Error("Tenant isolation violation: tenantId required");
    const isDestructive = CONFIRMATION_REQUIRED_TOOLS.has(toolName);

    // Confirmation Gate
    if (isDestructive && !approved) {
      return {
        status: "REQUIRES_APPROVAL",
        toolName,
        arguments: args,
        message: `Action '${toolName}' alters enterprise state and requires user confirmation.`
      };
    }

    // Execution Handlers
    switch (toolName) {
      case "get_leads": {
        const filter = (args.filter || "").toLowerCase();
        const allLeads = Array.from(this.dbClient.mockStore.leads.values())
          .filter(l => l.tenant_id === String(tenantId));
        const matched = filter
          ? allLeads.filter(l => l.name.toLowerCase().includes(filter) || l.company.toLowerCase().includes(filter))
          : allLeads;
        return {
          status: "SUCCESS",
          count: matched.length,
          leads: matched.slice(0, args.limit || 10)
        };
      }

      case "create_lead": {
        const leadId = `lead_${Date.now()}`;
        const lead = {
          id: leadId,
          tenant_id: String(tenantId),
          name: args.name,
          email: args.email,
          company: args.company,
          status: "NEW",
          created_at: new Date().toISOString()
        };
        this.dbClient.mockStore.leads.set(leadId, lead);

        // Record Transactional Outbox Event
        if (this.dbClient.insertOutboxEvent) {
          await this.dbClient.insertOutboxEvent(tenantId, "LEAD", "LEAD_CREATED", lead);
        }

        return {
          status: "SUCCESS",
          leadId,
          message: `Lead for '${args.name}' (${args.company}) created successfully.`
        };
      }

      case "update_deal_stage": {
        const deal = this.dbClient.mockStore.deals.get(args.dealId);
        if (!deal || deal.tenant_id !== String(tenantId)) {
          return { status: "ERROR", message: "Deal not found or unauthorized." };
        }
        deal.stage = args.newStage;
        deal.updated_at = new Date().toISOString();

        if (this.dbClient.insertOutboxEvent) {
          await this.dbClient.insertOutboxEvent(tenantId, "DEAL", "DEAL_STAGE_UPDATED", deal);
        }

        return {
          status: "SUCCESS",
          dealId: args.dealId,
          newStage: args.newStage
        };
      }

      default:
        throw new Error(`Unsupported tool: ${toolName}`);
    }
  }
}

module.exports = {
  CONFIRMATION_REQUIRED_TOOLS,
  TOOLS_SCHEMA,
  ToolExecutor
};
