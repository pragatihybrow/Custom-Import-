# Copyright (c) 2026, Pragati Dike and contributors
# For license information, please see license.txt

import frappe


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": "PO Number", "fieldname": "po_number", "fieldtype": "Link",
			"options": "Purchase Order", "width": 150},
		{"label": "Supplier Code", "fieldname": "supplier_code", "fieldtype": "Link",
			"options": "Supplier", "width": 110},
		{"label": "Supplier Name", "fieldname": "supplier_name", "fieldtype": "Data", "width": 180},
		{"label": "PO Date", "fieldname": "po_date", "fieldtype": "Date", "width": 100},
		{"label": "PO Grand Total", "fieldname": "po_grand_total", "fieldtype": "Currency", "width": 120},

		{"label": "Sent By", "fieldname": "sent_by", "fieldtype": "Data", "width": 140},
		{"label": "Sent For Approval On", "fieldname": "sent_for_approval_on", "fieldtype": "Datetime", "width": 160},
		{"label": "Purchase Head", "fieldname": "purchase_head", "fieldtype": "Data", "width": 140},
		{"label": "Purchase Head Decision", "fieldname": "purchase_head_decision", "fieldtype": "Data", "width": 120},
		{"label": "Decision On", "fieldname": "decision_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PO Current State", "fieldname": "po_current_state", "fieldtype": "Data", "width": 160},

		{"label": "Pickup Request", "fieldname": "pickup_request", "fieldtype": "Link",
			"options": "Pickup Request", "width": 140},
		{"label": "Pickup Date", "fieldname": "pickup_date", "fieldtype": "Date", "width": 100},
		{"label": "Mode of Shipment", "fieldname": "mode_of_shipment", "fieldtype": "Data", "width": 130},
		{"label": "Pickup Grand Total", "fieldname": "pickup_grand_total", "fieldtype": "Currency", "width": 130},

		{"label": "Pickup Sent By", "fieldname": "pickup_sent_by", "fieldtype": "Data", "width": 140},
		{"label": "Pickup Sent On", "fieldname": "pickup_sent_on", "fieldtype": "Datetime", "width": 160},
		{"label": "Pickup Completed By", "fieldname": "pickup_completed_by", "fieldtype": "Data", "width": 140},
		{"label": "Pickup Completed On", "fieldname": "pickup_completed_on", "fieldtype": "Datetime", "width": 160},
		{"label": "Pickup Current State", "fieldname": "pickup_current_state", "fieldtype": "Data", "width": 150},

		{"label": "Payment Requisition", "fieldname": "payment_requisition", "fieldtype": "Link",
			"options": "Payment Requisition", "width": 160},
		{"label": "Payment Type", "fieldname": "payment_type", "fieldtype": "Data", "width": 150},
		{"label": "Duty Amount", "fieldname": "duty_amount", "fieldtype": "Currency", "width": 110},
		{"label": "PR Posting Date", "fieldname": "pr_posting_date", "fieldtype": "Date", "width": 110},

		{"label": "PR Sent By", "fieldname": "pr_sent_by", "fieldtype": "Data", "width": 140},
		{"label": "PR Sent On", "fieldname": "pr_sent_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PR Manager Approved By", "fieldname": "pr_manager_approved_by", "fieldtype": "Data", "width": 150},
		{"label": "PR Manager Approved On", "fieldname": "pr_manager_approved_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PR GST Approved By", "fieldname": "pr_gst_approved_by", "fieldtype": "Data", "width": 150},
		{"label": "PR GST Approved On", "fieldname": "pr_gst_approved_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PR Accounts Approved By", "fieldname": "pr_accounts_approved_by", "fieldtype": "Data", "width": 150},
		{"label": "PR Accounts Approved On", "fieldname": "pr_accounts_approved_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PR Current State", "fieldname": "pr_current_state", "fieldtype": "Data", "width": 170},

		{"label": "Journal Entry", "fieldname": "journal_entry", "fieldtype": "Link",
			"options": "Journal Entry", "width": 170},
		{"label": "JE Posting Date", "fieldname": "je_posting_date", "fieldtype": "Date", "width": 110},
		{"label": "JE Amount", "fieldname": "je_amount", "fieldtype": "Currency", "width": 120},
		{"label": "JE Sent By", "fieldname": "je_sent_by", "fieldtype": "Data", "width": 140},
		{"label": "JE Sent On", "fieldname": "je_sent_on", "fieldtype": "Datetime", "width": 160},
		{"label": "JE Approved By", "fieldname": "je_approved_by", "fieldtype": "Data", "width": 140},
		{"label": "JE Approved On", "fieldname": "je_approved_on", "fieldtype": "Datetime", "width": 160},
		{"label": "JE Current State", "fieldname": "je_current_state", "fieldtype": "Data", "width": 170},

		# --- Payment Entry (linked off the Journal Entry via Payment Entry Reference) ---
		{"label": "Payment Entry", "fieldname": "payment_entry", "fieldtype": "Link",
			"options": "Payment Entry", "width": 170},
		{"label": "PE Created On", "fieldname": "pe_created_on", "fieldtype": "Datetime", "width": 160},
		{"label": "PE Created By", "fieldname": "pe_created_by", "fieldtype": "Data", "width": 140},
		{"label": "PE Submitted By", "fieldname": "pe_submitted_by", "fieldtype": "Data", "width": 140},
		{"label": "PE Submitted On", "fieldname": "pe_submitted_on", "fieldtype": "Datetime", "width": 160},
	]


def get_data(filters):
	conditions, values = get_conditions(filters)

	query = f"""
		SELECT
			po.name AS po_number,
			po.supplier AS supplier_code,
			po.supplier_name AS supplier_name,
			po.transaction_date AS po_date,
			po.grand_total AS po_grand_total,

			MAX(CASE
				WHEN wa.workflow_state = 'Draft' AND wa.status = 'Completed'
				THEN u_owner.full_name
			END) AS sent_by,

			MAX(CASE
				WHEN wa.workflow_state = 'Draft' AND wa.status = 'Completed'
				THEN wa.creation
			END) AS sent_for_approval_on,

			MAX(CASE
				WHEN wa.workflow_state = 'Pending Approval Of Purchase Head' AND wa.status = 'Completed'
				THEN u_owner.full_name
			END) AS purchase_head,

			CASE
				WHEN po.workflow_state = 'Approved By Purchase Head' THEN 'Approved'
				WHEN po.workflow_state = 'Rejected By Purchase Head' THEN 'Rejected'
				WHEN po.workflow_state = 'Cancelled' THEN 'Cancelled'
				ELSE NULL
			END AS purchase_head_decision,

			MAX(CASE
				WHEN wa.workflow_state = 'Pending Approval Of Purchase Head' AND wa.status = 'Completed'
				THEN wa.creation
			END) AS decision_on,

			po.workflow_state AS po_current_state,

			pr.name AS pickup_request,
			pr.po_date AS pickup_date,
			pr.mode_of_shipment AS mode_of_shipment,
			pr.grand_total AS pickup_grand_total,

			MAX(CASE
				WHEN wa_pr.workflow_state = 'Open' AND wa_pr.status = 'Completed'
				THEN u_owner_pr.full_name
			END) AS pickup_sent_by,

			MAX(CASE
				WHEN wa_pr.workflow_state = 'Open' AND wa_pr.status = 'Completed'
				THEN wa_pr.creation
			END) AS pickup_sent_on,

			MAX(CASE
				WHEN wa_pr.workflow_state = 'In Progress' AND wa_pr.status = 'Completed'
				THEN u_owner_pr.full_name
			END) AS pickup_completed_by,

			MAX(CASE
				WHEN wa_pr.workflow_state = 'In Progress' AND wa_pr.status = 'Completed'
				THEN wa_pr.creation
			END) AS pickup_completed_on,

			pr.workflow_state AS pickup_current_state,

			payreq.name AS payment_requisition,
			payreq.payment_type AS payment_type,
			payreq.duty_amount AS duty_amount,
			payreq.posting_date AS pr_posting_date,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Open' AND wa_payreq.status = 'Completed'
				THEN u_owner_payreq.full_name
			END) AS pr_sent_by,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Open' AND wa_payreq.status = 'Completed'
				THEN wa_payreq.creation
			END) AS pr_sent_on,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For Manager Approval' AND wa_payreq.status = 'Completed'
				THEN u_owner_payreq.full_name
			END) AS pr_manager_approved_by,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For Manager Approval' AND wa_payreq.status = 'Completed'
				THEN wa_payreq.creation
			END) AS pr_manager_approved_on,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For GST Team Approval' AND wa_payreq.status = 'Completed'
				THEN u_owner_payreq.full_name
			END) AS pr_gst_approved_by,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For GST Team Approval' AND wa_payreq.status = 'Completed'
				THEN wa_payreq.creation
			END) AS pr_gst_approved_on,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For Account Team Approval' AND wa_payreq.status = 'Completed'
				THEN u_owner_payreq.full_name
			END) AS pr_accounts_approved_by,

			MAX(CASE
				WHEN wa_payreq.workflow_state = 'Sent For Account Team Approval' AND wa_payreq.status = 'Completed'
				THEN wa_payreq.creation
			END) AS pr_accounts_approved_on,

			payreq.workflow_state AS pr_current_state,

			je.name AS journal_entry,
			je.posting_date AS je_posting_date,
			je.total_amount AS je_amount,

			MAX(CASE
				WHEN wa_je.workflow_state = 'Draft' AND wa_je.status = 'Completed'
				THEN u_owner_je.full_name
			END) AS je_sent_by,

			MAX(CASE
				WHEN wa_je.workflow_state = 'Draft' AND wa_je.status = 'Completed'
				THEN wa_je.creation
			END) AS je_sent_on,

			MAX(CASE
				WHEN wa_je.workflow_state = 'Pending by Accounts Manager' AND wa_je.status = 'Completed'
				THEN u_owner_je.full_name
			END) AS je_approved_by,

			MAX(CASE
				WHEN wa_je.workflow_state = 'Pending by Accounts Manager' AND wa_je.status = 'Completed'
				THEN wa_je.creation
			END) AS je_approved_on,

			je.workflow_state AS je_current_state,

			pe.name AS payment_entry,
			pe.creation AS pe_created_on,
			u_owner_pe.full_name AS pe_created_by,
			u_modified_pe.full_name AS pe_submitted_by,
			pe.modified AS pe_submitted_on

		FROM `tabPurchase Order` po

		LEFT JOIN `tabPO CT` pno
			ON pno.purchase_order = po.name
			AND pno.parenttype = 'Pickup Request'

		LEFT JOIN `tabPickup Request` pr
			ON pr.name = pno.parent

		LEFT JOIN `tabWorkflow Action` wa
			ON wa.reference_name = po.name
			AND wa.reference_doctype = 'Purchase Order'

		LEFT JOIN `tabUser` u_owner
			ON u_owner.name = wa.owner

		LEFT JOIN `tabWorkflow Action` wa_pr
			ON wa_pr.reference_name = pr.name
			AND wa_pr.reference_doctype = 'Pickup Request'

		LEFT JOIN `tabUser` u_owner_pr
			ON u_owner_pr.name = wa_pr.owner

		LEFT JOIN `tabPickup Request CT` prct
			ON prct.pickup_request = pr.name
			AND prct.parenttype = 'Payment Requisition'

		LEFT JOIN `tabPayment Requisition` payreq
			ON payreq.name = prct.parent

		LEFT JOIN `tabWorkflow Action` wa_payreq
			ON wa_payreq.reference_name = payreq.name
			AND wa_payreq.reference_doctype = 'Payment Requisition'

		LEFT JOIN `tabUser` u_owner_payreq
			ON u_owner_payreq.name = wa_payreq.owner

		LEFT JOIN `tabJournal Entry` je
			ON je.custom_payment_requisition = payreq.name

		LEFT JOIN `tabWorkflow Action` wa_je
			ON wa_je.reference_name = je.name
			AND wa_je.reference_doctype = 'Journal Entry'

		LEFT JOIN `tabUser` u_owner_je
			ON u_owner_je.name = wa_je.owner

		LEFT JOIN `tabPayment Entry Reference` per
			ON per.reference_name = je.name
			AND per.reference_doctype = 'Journal Entry'

		LEFT JOIN `tabPayment Entry` pe
			ON pe.name = per.parent
			AND pe.docstatus = 1

		LEFT JOIN `tabUser` u_owner_pe
			ON u_owner_pe.name = pe.owner

		LEFT JOIN `tabUser` u_modified_pe
			ON u_modified_pe.name = pe.modified_by

		WHERE po.custom_purchase_sub_type = 'Import' {conditions}

		GROUP BY
			po.name, po.supplier, po.supplier_name, po.transaction_date,
			po.grand_total, po.workflow_state,
			pr.name, pr.po_date, pr.mode_of_shipment, pr.grand_total, pr.workflow_state,
			payreq.name, payreq.payment_type, payreq.duty_amount,
			payreq.posting_date, payreq.workflow_state,
			je.name, je.posting_date, je.total_amount, je.workflow_state,
			pe.name, pe.creation, pe.modified, u_owner_pe.full_name, u_modified_pe.full_name

		ORDER BY po.modified DESC, pr.name, payreq.name, je.name, pe.name
	"""

	return frappe.db.sql(query, values, as_dict=True)


def get_conditions(filters):
	conditions = ""
	values = {}

	if filters.get("supplier"):
		conditions += " AND po.supplier = %(supplier)s"
		values["supplier"] = filters.get("supplier")

	if filters.get("from_date"):
		conditions += " AND po.transaction_date >= %(from_date)s"
		values["from_date"] = filters.get("from_date")

	if filters.get("to_date"):
		conditions += " AND po.transaction_date <= %(to_date)s"
		values["to_date"] = filters.get("to_date")

	if filters.get("purchase_order"):
		conditions += " AND po.name = %(purchase_order)s"
		values["purchase_order"] = filters.get("purchase_order")

	if filters.get("po_current_state"):
		conditions += " AND po.workflow_state LIKE %(po_current_state)s"
		values["po_current_state"] = f"%{filters.get('po_current_state')}%"

	if filters.get("pickup_request"):
		conditions += " AND pr.name = %(pickup_request)s"
		values["pickup_request"] = filters.get("pickup_request")

	if filters.get("pickup_current_state"):
		conditions += " AND pr.workflow_state LIKE %(pickup_current_state)s"
		values["pickup_current_state"] = f"%{filters.get('pickup_current_state')}%"

	if filters.get("payment_requisition"):
		conditions += " AND payreq.name = %(payment_requisition)s"
		values["payment_requisition"] = filters.get("payment_requisition")

	if filters.get("pr_current_state"):
		conditions += " AND payreq.workflow_state LIKE %(pr_current_state)s"
		values["pr_current_state"] = f"%{filters.get('pr_current_state')}%"

	if filters.get("journal_entry"):
		conditions += " AND je.name = %(journal_entry)s"
		values["journal_entry"] = filters.get("journal_entry")

	if filters.get("je_current_state"):
		conditions += " AND je.workflow_state LIKE %(je_current_state)s"
		values["je_current_state"] = f"%{filters.get('je_current_state')}%"

	if filters.get("payment_entry"):
		conditions += " AND pe.name = %(payment_entry)s"
		values["payment_entry"] = filters.get("payment_entry")

	return conditions, values