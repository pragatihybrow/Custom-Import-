# Copyright (c) 2026, Pragati Dike and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


@frappe.whitelist()
def send_vendor_payment_correction_mail(vendor_payment_form_name=None):
	vendor_payment_form_name = vendor_payment_form_name or frappe.form_dict.get("vendor_payment_form_name")

	if not vendor_payment_form_name:
		frappe.throw(_("Vendor Payment Form name is required"))

	doc = frappe.get_doc("Vendor Payment Form", vendor_payment_form_name)

	supplier_id = doc.get("supplier")

	if not supplier_id:
		frappe.throw(_("Supplier is not set on this Vendor Payment Form"))

	supplier = frappe.get_doc("Supplier", supplier_id)

	if not supplier.supplier_primary_address:
		frappe.throw(_("Primary Address is not set for supplier: {0}").format(supplier.supplier_name))

	address = frappe.get_doc("Address", supplier.supplier_primary_address)

	if not address.email_id:
		frappe.throw(_("Email ID is not set on the supplier's primary address"))

	vendor_form_link = frappe.utils.get_url() + "/vendor-payment-forms?supplier=" + str(supplier_id)

	message_body = """Dear <b>{supplier_name}</b>,<br><br>

		Greetings!<br><br>

		Your Vendor Payment Form has been sent back for correction.<br><br>

		<b>Reason:</b> {reason}<br><br>

		Please review and update the form using the link below. Your previously filled details are already prefilled.<br><br>

		<a href="{link}">
			Update Vendor Payment Form
		</a><br><br>

		Regards,<br>
		Accounts Team""".format(
		supplier_name=frappe.utils.escape_html(supplier.supplier_name or ""),
		reason=frappe.utils.escape_html(doc.remark or ""),
		link=vendor_form_link,
	)

	frappe.sendmail(
		recipients=[address.email_id],
		subject="Vendor Payment Form - Correction Required",
		message=message_body,
	)

	frappe.response["message"] = f"Correction mail sent successfully to {address.email_id}"

class VendorPaymentForm(Document):
	pass
