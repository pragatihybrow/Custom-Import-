
import frappe
from frappe.utils import flt
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from erpnext.buying.doctype.purchase_order.purchase_order import make_purchase_invoice as erpnext_make_pi

# ------------------- MAKE PURCHASE INVOICE -------------------

@frappe.whitelist()
def make_purchase_invoice(source_name, target_doc=None):
    doc = erpnext_make_pi(source_name, target_doc)
    po = frappe.get_doc("Purchase Order", source_name)
    doc.custom_purchase_order = source_name
    # doc.custom_pickup_request = po.custom_pickup_request
    return doc

# ------------------- STAGE STATUS -------------------
@frappe.whitelist()
def get_stage_status(purchase_order_name):
    """
    Returns stage counts per Pickup Request and totals for PO-level stages.
    """
    status = {
        "pickup_requests": {},
        "payment_entry": 0,
        "purchase_receipt": 0,
        "purchase_invoice": 0
    }

    # ---- Get all Pickup Requests for this PO ----
    pickup_requests = frappe.get_all(
        "Pickup Request CT",
        filters={"parent": purchase_order_name},
        pluck="pickup_request"
    )

    # ---- Count stages per Pickup Request ----
    for pr in pickup_requests:
        pr_status = {}

        # RFQs linked to this Pickup Request
        rfq_list = frappe.get_all(
            "Request for Quotation",
            filters={"custom_pickup_request": pr},
            pluck="name"
        )
        pr_status["rfq"] = len(rfq_list)

        # Supplier Quotations linked ONLY to these RFQs
        sq_count = 0
        for rfq in rfq_list:
            # Get distinct Supplier Quotation documents that have at least one item for this RFQ
            sq_docs = frappe.get_all(
                "Supplier Quotation Item",
                filters={"request_for_quotation": rfq},
                fields=["parent"]
            )
            sq_count += len(set([sq["parent"] for sq in sq_docs]))

        pr_status["supplier_quotation"] = sq_count

        # Pre Alerts linked to this Pickup Request
        pre_alert_count = frappe.get_all(
            "Pre Alert",
            filters={"pickup_request": pr},
            pluck="name"
        )
        pr_status["pre_alert"] = len(pre_alert_count)

        # Bill of Entry linked to this Pickup Request
        boe_count = frappe.get_all(
            "BOE",
            filters={"pickup_request": pr},
            pluck="name"
        )
        pr_status["bill_of_entry"] = len(boe_count)

        status["pickup_requests"][pr] = pr_status

    # ---- PO-level counts ----
    status["payment_entry"] = len(frappe.get_all(
        "Payment Entry",
        filters={"custom_po_no": purchase_order_name, "docstatus": 1},
        pluck="name"
    ))
    status["purchase_receipt"] = len(set(frappe.get_all(
        "Purchase Receipt Item",
        filters={"purchase_order": purchase_order_name, "docstatus": 1},
        pluck="parent"
    )))

    status["purchase_invoice"] = len(set(frappe.get_all(
        "Purchase Invoice Item", 
        filters={"purchase_order": purchase_order_name, "docstatus": 1},
        pluck="parent"
    )))
    

    return status

# ------------------- EXTRA CHARGES -------------------

@frappe.whitelist()
def get_extra_charge_template(name):
    return frappe.db.sql("SELECT * FROM `tabItem Charges Template` WHERE parent=%s", (name,), as_dict=True)

# ------------------- MATERIAL REQUEST ITEM -------------------

@frappe.whitelist()
def get_mr_item_fields(mr_item_name):
    return frappe.db.get_value(
        "Material Request Item",
        mr_item_name,
        ["custom_materil_po_text", "custom_supplier_suggestion", "custom_other_remarks", "custom_item_note"],
        as_dict=True
    )

# ------------------- PAYMENT ENTRY -------------------

@frappe.whitelist()
def create_payment_entry_from_po(po_name):
    return get_payment_entry("Purchase Order", po_name)

# @frappe.whitelist()
# def prepare_payment_entry(dt, dn, party_amount=None, bank_account=None, pickup_request=None):
#     """
#     Prepare a Payment Entry for a Purchase Order.
#     pickup_request: single Pickup Request name (string)
#     """
#     po = frappe.get_doc(dt, dn)
#     pe = get_payment_entry("Purchase Order", po.name)
#     pr = frappe.get_doc("Pickup Request", pickup_request)
#     amount_to_pay = flt(party_amount or pr.base_grand_total)
    

#     payment_entry_doc = get_payment_entry(dt, dn, party_amount=amount_to_pay, bank_account=bank_account)

#     if pickup_request:
#         payment_entry_doc.custom_pickup_request = pickup_request  # assign single value only

#     return payment_entry_doc



# import frappe
# from frappe.utils import flt
# from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

# @frappe.whitelist()
# def prepare_payment_entry(dt, dn, party_amount=None, bank_account=None, pickup_request=None):
   
#     po = frappe.get_doc(dt, dn)

#     pr = frappe.get_doc("Pickup Request", pickup_request) if pickup_request else None
#     amount_to_pay = frappe.db.sql("""
#         SELECT SUM(amount_in_inr)
#         FROM `tabPurchase Order Details`
#         WHERE po_number = %s
#           AND parent = %s
#     """, (po.name, pickup_request))[0][0] or 0

#     if not amount_to_pay:
#         amount_to_pay = flt(party_amount or (pr.base_grand_total if pr else 0))

#     payment_entry_doc = get_payment_entry(dt, dn, party_amount=flt(amount_to_pay), bank_account=bank_account)

#     if pickup_request:
#         payment_entry_doc.custom_pickup_request = pickup_request

#     return payment_entry_doc


import frappe
from frappe.utils import flt, cint
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

@frappe.whitelist()
def prepare_payment_entry(dt, dn, party_amount=None, bank_account=None, pickup_request=None):
    """
    Enhanced version of your original function with better error handling
    """
    # Validate inputs
    if not dt or not dn:
        frappe.throw("Document Type and Document Name are required")
    
    # Get purchase order document
    try:
        po = frappe.get_doc(dt, dn)
    except Exception as e:
        frappe.throw(f"Could not fetch {dt} {dn}: {str(e)}")
    
    # Get pickup request if provided
    pr = None
    if pickup_request:
        try:
            pr = frappe.get_doc("Pickup Request", pickup_request)
        except Exception as e:
            frappe.throw(f"Could not fetch Pickup Request {pickup_request}: {str(e)}")
    
    # Calculate amount to pay
    amount_to_pay = 0
    
    if pickup_request:
        # Get amount from pickup request details
        amount_result = frappe.db.sql("""
            SELECT SUM(amount_in_inr) as total_amount
            FROM `tabPurchase Order Details`
            WHERE po_number = %s
              AND parent = %s
        """, (po.name, pickup_request), as_dict=True)
        
        amount_to_pay = flt(amount_result[0].total_amount) if amount_result else 0
    
    # Fallback to provided amount or PO grand total
    if not amount_to_pay:
        if party_amount:
            amount_to_pay = flt(party_amount)
        elif pr:
            amount_to_pay = flt(pr.base_grand_total)
        else:
            amount_to_pay = flt(po.grand_total)
    
    # Create payment entry
    try:
        payment_entry_doc = get_payment_entry(dt, dn, 
                                            party_amount=amount_to_pay, 
                                            bank_account=bank_account)
    except Exception as e:
        frappe.throw(f"Could not create payment entry: {str(e)}")
    
    # Set custom fields
    if pickup_request:
        payment_entry_doc.custom_pickup_request = pickup_request
        payment_entry_doc.remarks = f"Payment for PO {po.name} (Pickup Request: {pickup_request})"
    
    return payment_entry_doc

