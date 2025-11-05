
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


# import frappe
# from frappe.utils import flt

# @frappe.whitelist()
# def create_custom_duty_journal_entry(purchase_order, duty_amount):
#     po = frappe.get_doc("Purchase Order", purchase_order)
#     duty_amount = flt(duty_amount)

#     if duty_amount <= 0:
#         frappe.throw("Please enter a valid Custom Duty Amount greater than zero.")

#     # Validation
#     if not (po.custom_pickup_status == "Fully Picked" and po.custom_pickup_request):
#         frappe.throw("Journal Entry can only be created if Pickup Status is 'Fully Picked' and Pickup Request is present.")

#     # Avoid duplicates
#     existing_je = frappe.db.exists("Journal Entry", {"custom_purchase_order": po.name})
#     if existing_je:
#         frappe.throw(f"Journal Entry already exists for this Purchase Order: <b>{existing_je}</b>")

#     # Create Journal Entry
#     je = frappe.new_doc("Journal Entry")
#     je.voucher_type = "Journal Entry"
#     je.company = po.company
#     je.posting_date = frappe.utils.nowdate()
#     je.user_remark = f"Custom Duty Expense for Purchase Order {po.name}"
#     je.custom_purchase_order = po.name

#     # Define accounts (you can change these account names as per your chart)
#     custom_duty_expense_account = "Custom Duty Expense - " + po.company_abbr
#     custom_duty_payable_account = "Duties and Taxes - " + po.company_abbr

#     # 🔸 Debit: Custom Duty Expense
#     je.append("accounts", {
#         "account": custom_duty_expense_account,
#         "debit_in_account_currency": duty_amount,
#         "credit_in_account_currency": 0
#     })

#     # 🔸 Credit: Custom Duty Payable
#     je.append("accounts", {
#         "account": custom_duty_payable_account,
#         "credit_in_account_currency": duty_amount,
#         "debit_in_account_currency": 0,
#         "party_type": "Supplier",
#         "party": po.supplier
#     })

#     je.insert(ignore_permissions=True)
#     je.submit()

#     frappe.msgprint(f"✅ Custom Duty Journal Entry {je.name} created successfully.")
#     return je.name
