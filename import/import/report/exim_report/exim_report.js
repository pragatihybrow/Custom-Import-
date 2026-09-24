// Copyright (c) 2026, Pragati Dike and contributors
// For license information, please see license.txt

frappe.query_reports["Exim Report"] = {
	"filters": [
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today()
		},
		{
			"fieldname": "supplier",
			"label": __("Supplier"),
			"fieldtype": "Link",
			"options": "Supplier"
		},
		{
			"fieldname": "purchase_order",
			"label": __("Purchase Order"),
			"fieldtype": "Link",
			"options": "Purchase Order"
		},
		{
			"fieldname": "po_current_state",
			"label": __("PO Current State"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "pickup_request",
			"label": __("Pickup Request"),
			"fieldtype": "Link",
			"options": "Pickup Request"
		},
		{
			"fieldname": "pickup_current_state",
			"label": __("Pickup Current State"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "payment_requisition",
			"label": __("Payment Requisition"),
			"fieldtype": "Link",
			"options": "Payment Requisition"
		},
		{
			"fieldname": "pr_current_state",
			"label": __("PR Current State"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "journal_entry",
			"label": __("Journal Entry"),
			"fieldtype": "Link",
			"options": "Journal Entry"
		},
		{
			"fieldname": "je_current_state",
			"label": __("JE Current State"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "payment_entry",
			"label": __("Payment Entry"),
			"fieldtype": "Link",
			"options": "Payment Entry"
		}
	]
};