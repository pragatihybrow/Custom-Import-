import frappe
from frappe.utils import get_url
from frappe.utils import get_url_to_form, fmt_money
from frappe import _

@frappe.whitelist()
def get_supplier_previously_data(item_code):
    suppliers = frappe.db.sql("""
        SELECT DISTINCT supplier
        FROM `tabPurchase Order`
        WHERE docstatus = 1 AND name IN (
            SELECT parent FROM `tabPurchase Order Item` WHERE item_code = %s
        )
    """, (item_code,), as_dict=True)

    result = {}

    for supplier_entry in suppliers:
        supplier = supplier_entry.supplier

        po = frappe.db.sql("""
            SELECT name
            FROM `tabPurchase Order`
            WHERE supplier = %s AND docstatus = 1
            ORDER BY transaction_date DESC, creation DESC
            LIMIT 1
        """, (supplier,), as_dict=True)

        if po:
            po_name = po[0].name

            data = frappe.db.sql("""
                SELECT rate, qty, received_qty
                FROM `tabPurchase Order Item`
                WHERE parent = %s AND item_code = %s
            """, (po_name, item_code), as_dict=True)

            if data:
                result[supplier] = data[0]  

    return result


def get_exim_cc(pickup_request):
    if not pickup_request:
        return []

    exim_user = frappe.db.get_value("Pickup Request", pickup_request, "exim_user")
    if not exim_user:
        return []

    email = frappe.db.get_value("User", exim_user, "email") or (
        exim_user if "@" in exim_user else None
    )
    return [email] if email else []


def get_shipping_document_attachment(pickup_request):
    if not pickup_request:
        return []

    file_url = frappe.db.get_value("Pickup Request", pickup_request, "shipping_document")
    if not file_url:
        return []

    try:
        file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
        if not file_name:
            frappe.log_error(
                message=f"File record not found for {file_url}",
                title=f"RFQ email: shipping_document missing ({pickup_request})",
            )
            return []

        file_doc = frappe.get_doc("File", file_name)
        return [{"fname": file_doc.file_name, "fcontent": file_doc.get_content()}]
    except Exception:
        frappe.log_error(
            message=frappe.get_traceback(),
            title=f"RFQ email: could not attach shipping_document ({pickup_request})",
        )
        return []


def on_rfq_submit(doc, method=None):
    if not doc.get("suppliers"):
        return

    pickup_request = doc.get("custom_pickup_request")

    # Fetch once, reuse for every supplier
    exim_cc = get_exim_cc(pickup_request)
    attachments = get_shipping_document_attachment(pickup_request)

    message = frappe.render_template(doc.message_for_supplier or "", doc.as_dict())
    subject = _("Request for Quotation {0}").format(doc.name)

    for row in doc.suppliers:
        if not row.email_id:
            continue

        # don't CC someone who is already the recipient
        cc = [c for c in exim_cc if c.lower() != row.email_id.lower()]

        try:
            frappe.sendmail(
                recipients=[row.email_id],
                cc=cc,
                subject=subject,
                message=message,
                attachments=attachments,
                reference_doctype="Request for Quotation",
                reference_name=doc.name,
                delayed=False,
            )
        except Exception:
            frappe.log_error(
                message=frappe.get_traceback(),
                title=f"RFQ email failed: {doc.name} / {row.email_id}",
            )