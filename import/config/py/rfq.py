import frappe
from frappe.utils import get_url


@frappe.whitelist()
def get_supplier_previously_data(item_code):
    # Get all suppliers who have created Purchase Orders for the given item
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

        # Get the latest PO for this supplier and item
        po = frappe.db.sql("""
            SELECT name
            FROM `tabPurchase Order`
            WHERE supplier = %s AND docstatus = 1
            ORDER BY transaction_date DESC, creation DESC
            LIMIT 1
        """, (supplier,), as_dict=True)

        if po:
            po_name = po[0].name

            # Get the PO Item details for this supplier and item
            data = frappe.db.sql("""
                SELECT rate, qty, received_qty
                FROM `tabPurchase Order Item`
                WHERE parent = %s AND item_code = %s
            """, (po_name, item_code), as_dict=True)

            if data:
                result[supplier] = data[0]  # Store the first item’s data under the supplier

    return result


def on_rfq_submit(doc, method=None):
    """
    Send an email to each supplier on RFQ submit with a webform link pre-filled with RFQ and supplier.
    """
    base_url = get_url() 
    webform_base_url = f"{base_url}/supplier-quotation/new"

    for supplier_row in doc.suppliers:
        supplier = supplier_row.supplier
        email_id = supplier_row.email_id
        if not email_id:
            continue
        # Build webform link
        webform_link = f"{webform_base_url}?request_for_quotation={doc.name}&supplier={supplier}"
        subject = f"Request for Quotation {doc.name} - Submit Your Quotation"
        message = f"""
        Dear Supplier,<br><br>
        You are invited to submit your quotation for RFQ <b>{doc.name}</b>.<br>
        Please use the following link to submit your quotation:<br><br>
        <a href='{webform_link}' target='_blank'>Submit Quotation (Web Form)</a><br><br>
        Thank you.<br>
        """
        frappe.sendmail(
            recipients=[email_id],
            subject=subject,
            message=message,
            reference_doctype=doc.doctype,
            reference_name=doc.name,
            now=True,
        )
