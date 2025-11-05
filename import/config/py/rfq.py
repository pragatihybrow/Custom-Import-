import frappe
from frappe.utils import get_url
from frappe.utils import get_url_to_form, fmt_money


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


# def on_rfq_submit(doc, method=None):
#     """
#     Send an email to each supplier on RFQ submit with a webform link pre-filled with RFQ and supplier.
#     """
#     base_url = get_url() 
#     webform_base_url = f"{base_url}/supplier-quotation/new"

#     for supplier_row in doc.suppliers:
#         supplier = supplier_row.supplier
#         email_id = supplier_row.email_id
#         if not email_id:
#             continue
#         # Build webform link
#         webform_link = f"{webform_base_url}?request_for_quotation={doc.name}&supplier={supplier}"
#         subject = f"Request for Quotation {doc.name} - Submit Your Quotation"
#         message = f"""
#         Dear Supplier,<br><br>
#         You are invited to submit your quotation for RFQ <b>{doc.name}</b>.<br>
#         Please use the following link to submit your quotation:<br><br>
#         <a href='{webform_link}' target='_blank'>Submit Quotation (Web Form)</a><br><br>
#         Thank you.<br>
#         """
#         frappe.sendmail(
#             recipients=[email_id],
#             subject=subject,
#             message=message,
#             reference_doctype=doc.doctype,
#             reference_name=doc.name,
#             now=True,
#         )

def on_rfq_submit(doc, method=None):
    """
    Send an email to each supplier on RFQ submit with Pickup Request details
    fetched from the linked Pickup Request document.
    """
    # Get Pickup Request document linked in RFQ
    pickup_request = None
    if doc.custom_pickup_request:
        pickup_request = frappe.get_doc("Pickup Request", doc.custom_pickup_request)
    
    rfq_link = get_url_to_form(doc.doctype, doc.name)


    for supplier_row in doc.suppliers:
        supplier = supplier_row.supplier
        email_id = supplier_row.email_id
        if not email_id:
            continue

        subject = f"Request for Quotation {doc.name} - Submit Your Quotation"


        # Use pickup_request fields if available
        message = f"""
        <p>Dear {supplier},</p>
        <p>With reference to RFQ <b>{doc.name}</b>, you are invited to submit your quotation. 
        Please find below the shipment details for your reference.</p>

        <table border="1" cellpadding="6" cellspacing="0"
            style="border-collapse:collapse; width:auto; font-family:Arial; font-size:13px;">
            <tr><td><b>Pickup Reference Number:</b></td><td>{pickup_request.name if pickup_request else ''}</td></tr>
            <tr><td><b>Origin Country:</b></td><td>{pickup_request.country_origin if pickup_request else ''}</td></tr>
            <tr><td><b>Port of Loading (POL):</b></td><td>{pickup_request.port_of_loading_pol if pickup_request else ''}</td></tr>
            <tr><td><b>Port of Destination (POD):</b></td><td>{pickup_request.port_of_destination_pod if pickup_request else ''}</td></tr>
            <tr><td><b>Shipment Mode:</b></td><td>{pickup_request.type_of_shipments if pickup_request else ''}</td></tr>
            <tr><td><b>Expected Pickup Date:</b></td><td>{frappe.format(pickup_request.pickup_date_by, {'fieldtype': 'Date'}) if pickup_request and pickup_request.pickup_date_by else ''}</td></tr>
            <tr><td><b>Number of Packages:</b></td><td>{pickup_request.no_of_package if pickup_request else ''}</td></tr>
            <tr><td><b>Gross Weight:</b></td><td>{pickup_request.gross_weight if pickup_request else ''} Kg</td></tr>
            <tr><td><b>Dimensions (L*W*H):</b></td><td>{pickup_request.dimensions if pickup_request else ''}</td></tr>
            <tr><td><b>Product Category:</b></td><td>{pickup_request.type_of_cargo if pickup_request else ''}</td></tr>
            <tr><td><b>Shipment Value:</b></td><td>{frappe.utils.fmt_money(pickup_request.shipment_value, currency=pickup_request.currency) if pickup_request else ''}</td></tr>
            <tr><td><b>Incoterm:</b></td><td>{pickup_request.incoterm if pickup_request else ''}</td></tr>
        </table>
        <p><b>View RFQ Details:</b> <a href="{rfq_link}">{rfq_link}</a></p>

        <br>
        <p>Thank you,<br>{frappe.session.user}</p>
        """

        frappe.sendmail(
            recipients=[email_id],
            subject=subject,
            message=message,
            reference_doctype=doc.doctype,
            reference_name=doc.name,
            now=True,
        )
