# # # # Copyright (c) 2025, Pragati Dike and contributors
# # # #  For license information, please see license.txt



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
    Only includes items matching the Purchase Orders in Payment Entry.
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

    # Get all PO numbers from Payment Entry references
    po_numbers = [ref.reference_name for ref in pe_doc.references 
                  if ref.reference_doctype == "Purchase Order"]

    if not po_numbers:
        frappe.throw(_("No Purchase Orders found in Payment Entry"))

    # create new BOE doc
    boe_doc = frappe.new_doc("BOE")
    boe_doc.boe_date = nowdate()
    
    # Set pickup_request from Payment Entry
    pickup_req = pe_doc.custom_pickup_request if hasattr(pe_doc, 'custom_pickup_request') else None
    if pickup_req:
        boe_doc.pickup_request = pickup_req
    
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

    add_boe_entries_from_po_items(boe_doc, po_doc, pe_doc, po_numbers)

    return boe_doc


def add_boe_entries_from_po_items(boe_doc, po_doc, pe_doc, po_numbers):
    """
    Adds BOE entries from Pre Alerts linked to the Payment Entry's pickup request.
    Only includes items where po_no matches any PO in the Payment Entry.
    Sets the pre_alert field in BOE doc.
    """
    pickup_request = pe_doc.custom_pickup_request
    if not pickup_request:
        frappe.throw(_("Payment Entry does not have a Pickup Request"))

    # Get all Pre Alerts linked to this Pickup Request via child table
    # The Pre Alert has a child table "Pickup Request CT" with field "pickup_request"
    pre_alert_links = frappe.get_all(
        "Pickup Request CT",
        filters={
            "pickup_request": pickup_request,
            "parenttype": "Pre Alert"
        },
        fields=["parent"]
    )
    
    if not pre_alert_links:
        frappe.msgprint(_("No Pre Alerts found for Pickup Request: {0}").format(pickup_request))
        return
    
    pre_alert_names = list(set([link.parent for link in pre_alert_links]))
    
    # Get Pre Alert details - only submitted ones
    pre_alerts = frappe.get_all(
        "Pre Alert",
        filters={
            "name": ["in", pre_alert_names],
            "docstatus": 1
        },
        fields=["name", "accessible_val"]
    )

    if not pre_alerts:
        frappe.msgprint(_("No submitted Pre Alerts found for Pickup Request: {0}").format(pickup_request))
        return

    # Set Pre Alert name (using the first one if multiple)
    boe_doc.pre_alert = pre_alerts[0].get("name")
    
    # # Set accessible value from first Pre Alert
    # boe_doc.accessible_value = boe_doc.

    # Track totals
    total_entries_added = 0

    # Process each Pre Alert
    for pa in pre_alerts:
        # Get items from this Pre Alert that match our PO numbers
        matching_items = frappe.get_all(
            "Pre-Alert Item Details",
            filters={
                "parent": pa.name,
                "po_no": ["in", po_numbers]
            },
            fields=[
                "po_no",
                "item_code",
                "item_name",
                "description",
                "quantity",
                "total_inr_value",
                "bcd_amount",
                "igst_amount",
                "hcs_amount",
                "swl_amount",
                "rodtep_utilization",
                "total_duty"
            ]
        )

        # Create BOE entries for matching items
        for item in matching_items:
            entry = boe_doc.append("boe_entries", {})
            
            # Set all available fields from the item
            entry.po_number = item.get("po_no")
            
            # Try to set optional fields if they exist in child table
            if hasattr(entry, 'item_code'):
                entry.item_code = item.get("item_code")
            if hasattr(entry, 'item_name'):
                entry.item_name = item.get("item_name")
            if hasattr(entry, 'description'):
                entry.description = item.get("description")
            if hasattr(entry, 'total_qty'):
                entry.quantity = item.get("quantity", 0)
            
            # Set financial fields
            entry.total_inr_value = item.get("total_inr_value", 0)
            entry.total_bcd = item.get("bcd_amount", 0)
            entry.total_gst = item.get("igst_amount", 0)
            entry.total_h_cess = item.get("hcs_amount", 0)
            entry.total_sws = item.get("swl_amount", 0)
            entry.total_rodtep = item.get("rodtep_utilization", 0)
            entry.total_duty = item.get("total_duty", 0)
            
            total_entries_added += 1

    if total_entries_added == 0:
        frappe.msgprint(
            _("No Pre Alert items found matching Purchase Orders: {0}").format(", ".join(po_numbers)),
            indicator="orange"
        )
    else:
        frappe.msgprint(
            _("{0} BOE entries created for Purchase Orders: {1}").format(
                total_entries_added, ", ".join(po_numbers)
            ),
            indicator="green"
        )


@frappe.whitelist()
def make_bill_of_entry(source_name, args=None):
    """
    Standard entry point for make_mapped_doc
    """
    if args:
        import json
        if isinstance(args, str):
            args = json.loads(args)
    else:
        args = {}

    return create_boe_from_purchase_order(source_name, **args)


@frappe.whitelist()
def get_pickup_requests_for_po(po_name):
    """
    Find all submitted Pickup Requests that contain the given Purchase Order
    in their child table.
    """
    pickup_requests = frappe.get_all(
        "Pickup Request",
        filters={"docstatus": 1},
        fields=["name"]
    )
    
    valid_pickup_requests = []
    
    for pr in pickup_requests:
        pr_doc = frappe.get_doc("Pickup Request", pr.name)
        
        if hasattr(pr_doc, 'po_no'):
            for child in pr_doc.po_no:
                if child.purchase_order == po_name:
                    valid_pickup_requests.append(pr.name)
                    break
    
    return valid_pickup_requests


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
        accessible_value =  total_inr_value
        self.total_inr_value = accessible_value
        self.accessible_value = total_inr_value
        self.total_duty = total_duty
        self.bcd_amount = total_bcd
        self.igst_amount = total_gst
        self.total_rode_tape = total_rodtep
        self.sws_amount = total_sws
        self.h_cess_amount = total_h_cess

        # if self.currency != "INR":
        #     self.total_inr_value = total_inr_value * flt(self.exchange_rate)