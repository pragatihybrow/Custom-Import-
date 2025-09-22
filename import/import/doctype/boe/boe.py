# # # Copyright (c) 2025, Pragati Dike and contributors
# # #  For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document
from frappe.utils import nowdate



@frappe.whitelist()
def create_boe_from_purchase_order(purchase_order_name, **kwargs):
    """
    Creates a BOE from a Purchase Order and populates its child table
    from Pre Alerts linked to the Purchase Order's pickup request.
    """
    po_doc = frappe.get_doc("Purchase Order", purchase_order_name)

    payment_entry_name = kwargs.get("payment_entry_name")

    # If not passed, try to auto-detect linked Payment Entry
    if not payment_entry_name:
        linked_pe = frappe.db.get_value(
            "Payment Entry Reference",
            {"reference_doctype": "Purchase Order", "reference_name": po_doc.name},
            "parent"
        )
        if linked_pe:
            payment_entry_name = linked_pe

    if not payment_entry_name:
        frappe.throw(_("Payment Entry is required to create BOE"))

    pe_doc = frappe.get_doc("Payment Entry", payment_entry_name)

    # validate GST category
    # if po_doc.gst_category != "Overseas":
    #     frappe.throw(_("Purchase Order must have GST Category as 'Overseas' for BOE creation"))

    # create new BOE doc
    boe_doc = frappe.new_doc("BOE")
    boe_doc.boe_date = nowdate()
    boe_doc.pickup_request = pe_doc.custom_pickup_request
    boe_doc.vendor = po_doc.supplier
    boe_doc.currency = po_doc.currency
    boe_doc.exchange_rate = po_doc.conversion_rate or 1.0
    boe_doc.total_inr_val = po_doc.base_grand_total or 0.0
    boe_doc.remarks = f"Created from Purchase Order: {purchase_order_name}"
    boe_doc.po_no = po_doc.name

    # update extra fields if passed
    for key, val in kwargs.items():
        if hasattr(boe_doc, key):
            setattr(boe_doc, key, val)

    add_boe_entries_from_po_items(boe_doc, po_doc, pe_doc)

    return boe_doc


def add_boe_entries_from_po_items(boe_doc, po_doc, pe_doc):
    """
    Adds BOE entries from Pre Alerts linked to the Payment Entry's pickup request.
    Each Pre Alert will create one BOE entry.
    """
    pickup_request = pe_doc.custom_pickup_request
    if not pickup_request:
        frappe.throw(_("Payment Entry does not have a Pickup Request"))

    pre_alerts = frappe.get_all(
        "Pre Alert",
        filters={"pickup_request": pickup_request},
        fields=[
            "name",
            "total_inr_val",
            "tot_rodt_ut",
            "total_duty",
            "h_cess_amount",
            "bcd_amount",
            "igst_amount",
            "sws_amount",
            "accessible_val"
        ]
    )

    if pre_alerts:
        boe_doc.accessible_value = pre_alerts[0].get("accessible_val", 0)
    else:
        frappe.msgprint(_("No Pre Alerts found for this Pickup Request"))
        return

    for pa in pre_alerts:
        entry = boe_doc.append("boe_entries", {})
        entry.po_number = pa.get("name") 
        # entry.po_number = po_doc.name
        entry.total_inr_value = pa.get("total_inr_val", 0)
        entry.total_rodtep = pa.get("tot_rodt_ut", 0)
        entry.total_duty = pa.get("total_duty", 0)
        entry.total_h_cess = pa.get("h_cess_amount", 0)
        entry.total_bcd = pa.get("bcd_amount", 0)
        entry.total_gst = pa.get("igst_amount", 0)
        entry.total_sws = pa.get("sws_amount", 0)


@frappe.whitelist()
def make_bill_of_entry(source_name, args=None):
    """
    Standard entry point for make_mapped_doc
    """
    if args:
        import json
        if isinstance(args, str):
            args = json.loads(args)  # JS sends args as JSON string
    else:
        args = {}

    return create_boe_from_purchase_order(source_name, **args)


class BOE(Document):
    def validate(self):
        self.calculate_totals()

    def calculate_totals(self):
        """
        Calculate total amounts from BOE entries child table.
        """
        total_inr_value = sum([flt(entry.total_inr_value) for entry in self.boe_entries])
        total_duty = sum([flt(entry.total_duty) for entry in self.boe_entries])
        total_bcd = sum([flt(entry.total_bcd) for entry in self.boe_entries])
        total_gst = sum([flt(entry.total_gst) for entry in self.boe_entries])
        total_rodtep = sum([flt(entry.total_rodtep) for entry in self.boe_entries])
        total_sws = sum([flt(entry.total_sws) for entry in self.boe_entries])
        total_h_cess = sum([flt(entry.total_h_cess) for entry in self.boe_entries])

        self.total_inr_value = total_inr_value
        self.total_duty = total_duty
        self.bcd_amount = total_bcd
        self.igst_amount = total_gst
        self.total_rode_tape = total_rodtep
        self.sws_amount = total_sws
        self.h_cess_amount = total_h_cess

        if self.currency != "INR":
            self.total_inr_value = total_inr_value * flt(self.exchange_rate)
