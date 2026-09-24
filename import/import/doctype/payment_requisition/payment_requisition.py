# Copyright (c) 2026, Pragati Dike and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


def get_supplier_email(supplier):
	"""Resolve a usable email for the supplier: Supplier.email_id -> primary Contact -> primary Address."""
	if supplier.email_id:
		return supplier.email_id

	if supplier.supplier_primary_contact:
		contact_email = frappe.db.get_value("Contact", supplier.supplier_primary_contact, "email_id")
		if contact_email:
			return contact_email

	if supplier.supplier_primary_address:
		address_email = frappe.db.get_value("Address", supplier.supplier_primary_address, "email_id")
		if address_email:
			return address_email

	return None


@frappe.whitelist()
def send_payment_requisition_vendor_mail(payment_requisition_name=None):
	payment_requisition_name = payment_requisition_name or frappe.form_dict.get("payment_requisition_name")

	if not payment_requisition_name:
		frappe.throw(_("Payment Requisition name is required"))

	doc = frappe.get_doc("Payment Requisition", payment_requisition_name)

	if not doc.supplier_name:
		frappe.throw(_("Supplier is not set on this Payment Requisition"))

	supplier_id = doc.supplier_name[0].supplier

	if not supplier_id:
		frappe.throw(_("Supplier is not set on this Payment Requisition"))

	supplier = frappe.get_doc("Supplier", supplier_id)

	email_id = get_supplier_email(supplier)

	if not email_id:
		frappe.throw(_("No email found for supplier {0}. Please set an email on the Supplier, its primary Contact, or its primary Address.").format(supplier.supplier_name))

	vendor_form_link = frappe.utils.get_url() + "/vendor-payment-forms?supplier=" + str(supplier_id)

	message_body = """
		Dear <b>{supplier_name}</b>,<br><br>

		Greetings!<br><br>

		Please fill out the Vendor Payment Form using the link below so we can process your payment request. Your supplier details will already be filled in.<br><br>

		<a href="{link}">
			Fill Vendor Payment Form
		</a><br><br>

		Regards,<br>
		Accounts Team
	""".format(
		supplier_name=frappe.utils.escape_html(supplier.supplier_name or ""),
		link=vendor_form_link,
	)

	frappe.sendmail(
		recipients=[email_id],
		subject="Vendor Payment Form - Please Fill",
		message=message_body,
	)

	frappe.response["message"] = f"Mail sent successfully to {email_id}"


@frappe.whitelist(allow_guest=True)
def get_vendor_payment_form_data(supplier=None):
	supplier = supplier or frappe.form_dict.get("supplier")

	if not supplier:
		frappe.throw(_("Supplier is required"))

	existing = frappe.get_all(
		"Vendor Payment Form",
		filters={"supplier": supplier},
		fields=["name", "invoice_no", "invoice_value", "boe_no", "awb", "remark"],
		order_by="modified desc",
		limit_page_length=1,
	)

	if not existing:
		frappe.response["message"] = None
		return

	data = existing[0]

	attachments = frappe.get_all(
		"Vendor CT",
		filters={"parent": data["name"], "parenttype": "Vendor Payment Form"},
		fields=["attachment"],
	)
	data["attachments"] = [a["attachment"] for a in attachments if a.get("attachment")]

	frappe.response["message"] = data


def get_supplier_email(supplier):
	"""Resolve a usable email for the supplier: Supplier.email_id -> primary Contact -> primary Address."""
	if supplier.email_id:
		return supplier.email_id

	if supplier.supplier_primary_contact:
		contact_email = frappe.db.get_value("Contact", supplier.supplier_primary_contact, "email_id")
		if contact_email:
			return contact_email

	if supplier.supplier_primary_address:
		address_email = frappe.db.get_value("Address", supplier.supplier_primary_address, "email_id")
		if address_email:
			return address_email

	return None


@frappe.whitelist()
def send_payment_requisition_vendor_mail(payment_requisition_name=None):
	payment_requisition_name = payment_requisition_name or frappe.form_dict.get("payment_requisition_name")

	if not payment_requisition_name:
		frappe.throw(_("Payment Requisition name is required"))

	doc = frappe.get_doc("Payment Requisition", payment_requisition_name)

	if not doc.supplier_name:
		frappe.throw(_("Supplier is not set on this Payment Requisition"))

	supplier_id = doc.supplier_name[0].supplier

	if not supplier_id:
		frappe.throw(_("Supplier is not set on this Payment Requisition"))

	supplier = frappe.get_doc("Supplier", supplier_id)

	email_id = get_supplier_email(supplier)

	if not email_id:
		frappe.throw(_("No email found for supplier {0}. Please set an email on the Supplier, its primary Contact, or its primary Address.").format(supplier.supplier_name))

	vendor_form_link = frappe.utils.get_url() + "/vendor-payment-forms?supplier=" + str(supplier_id)

	message_body = """
		Dear <b>{supplier_name}</b>,<br><br>

		Greetings!<br><br>

		Please fill out the Vendor Payment Form using the link below so we can process your payment request. Your supplier details will already be filled in.<br><br>

		<a href="{link}">
			Fill Vendor Payment Form
		</a><br><br>

		Regards,<br>
		Accounts Team
	""".format(
		supplier_name=frappe.utils.escape_html(supplier.supplier_name or ""),
		link=vendor_form_link,
	)

	frappe.sendmail(
		recipients=[email_id],
		subject="Vendor Payment Form - Please Fill",
		message=message_body,
	)

	frappe.response["message"] = f"Mail sent successfully to {email_id}"


@frappe.whitelist(allow_guest=True)
def get_vendor_payment_form_data(supplier=None):
	supplier = supplier or frappe.form_dict.get("supplier")

	if not supplier:
		frappe.throw(_("Supplier is required"))

	existing = frappe.get_all(
		"Vendor Payment Form",
		filters={"supplier": supplier},
		fields=["name", "invoice_no", "invoice_value", "boe_no", "awb", "remark"],
		order_by="modified desc",
		limit_page_length=1,
	)

	if not existing:
		frappe.response["message"] = None
		return

	data = existing[0]

	attachments = frappe.get_all(
		"Vendor CT",
		filters={"parent": data["name"], "parenttype": "Vendor Payment Form"},
		fields=["attachment"],
	)
	data["attachments"] = [a["attachment"] for a in attachments if a.get("attachment")]

	frappe.response["message"] = data



class PaymentRequisition(Document):
	pass