# # # # Copyright (c) 2025, Pragati Dike and contributors
# # # #  For license information, please see license.txt



import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document
from frappe.utils import nowdate

@frappe.whitelist()
def create_boe(payment_requisition):
    from frappe.utils import nowdate, flt

    pr_doc = frappe.get_doc("Payment Requisition", payment_requisition)

    boe = frappe.new_doc("BOE")
    boe.cha = pr_doc.cha
    boe.boe_date = nowdate()
    boe.payment_requisition = pr_doc.name

    total_inr_value = 0

    # ✅ Pickup Requests
    if hasattr(pr_doc, "pickup_request_ct") and pr_doc.pickup_request_ct:
        for row in pr_doc.pickup_request_ct:
            if row.pickup_request:
                boe.append("pickup_request", {
                    "pickup_request": row.pickup_request   # ✅ FIXED
                })

                # Calculate total INR value
                try:
                    pck_doc = frappe.get_doc("Pickup Request", row.pickup_request)
                    total_inr_value += flt(getattr(pck_doc, "base_total", 0))
                except Exception:
                    frappe.log_error(frappe.get_traceback(), "BOE Pickup Fetch Error")

    boe.total_inr_value = total_inr_value

    # ✅ Purchase Orders
    if hasattr(pr_doc, "po_wono") and pr_doc.po_wono:
        for row in pr_doc.po_wono:
            if row.purchase_order:
                boe.append("po_no", {
                    "purchase_order": row.purchase_order
                })

    # ✅ Vendors (Suppliers)
    if hasattr(pr_doc, "supplier_name") and pr_doc.supplier_name:
        for row in pr_doc.supplier_name:
            if row.supplier:
                boe.append("vendor", {
                    "supplier": row.supplier
                })

    # ✅ Insert BOE
    boe.insert(ignore_permissions=True)
    frappe.db.commit()

    return boe.name

class BOE(Document):

    def before_cancel(self):
        if self.payment_requisition:
            frappe.db.set_value(
                "Payment Requisition",
                self.payment_requisition,
                "boe_no",
                None
            )

        self.flags.ignore_links = True
    # def validate(self):
    #     self.calculate_totals()

    # def calculate_totals(self):
    #     """
    #     Calculate total amounts from BOE entries child table.
    #     """
    #     total_inr_value = sum([flt(entry.total_inr_value) for entry in self.boe_entries])
    #     total_duty = sum([flt(entry.total_duty) for entry in self.boe_entries])
    #     total_bcd = sum([flt(entry.total_bcd) for entry in self.boe_entries])
    #     total_gst = sum([flt(entry.total_gst) for entry in self.boe_entries])
    #     total_rodtep = sum([flt(entry.total_rodtep) for entry in self.boe_entries])
    #     total_sws = sum([flt(entry.total_sws) for entry in self.boe_entries])
    #     total_h_cess = sum([flt(entry.total_h_cess) for entry in self.boe_entries])
    #     accessible_value =  total_inr_value
    #     self.total_inr_value = accessible_value
    #     self.accessible_value = total_inr_value
    #     self.total_duty = total_duty
    #     self.bcd_amount = total_bcd
    #     self.igst_amount = total_gst
    #     self.total_rode_tape = total_rodtep
    #     self.sws_amount = total_sws
    #     self.h_cess_amount = total_h_cess

        # if self.currency != "INR":
        #     self.total_inr_value = total_inr_value * flt(self.exchange_rate)