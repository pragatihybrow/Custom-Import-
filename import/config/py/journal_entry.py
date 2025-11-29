import frappe

def remove_payment_requisition_link(doc, method):
    """Remove Payment Requisition linkage before canceling Journal Entry"""
    
    # Find all Payment Requisitions linked to this Journal Entry (parent level only)
    linked_prs = frappe.db.sql("""
        SELECT name
        FROM `tabPayment Requisition`
        WHERE journal_entry = %s
        AND docstatus = 1
    """, doc.name, as_dict=1)
    
    if linked_prs:
        for pr in linked_prs:
            # Clear the journal entry link
            frappe.db.set_value(
                'Payment Requisition',
                pr.name,
                'journal_entry',
                None,
                update_modified=False
            )
            
            frappe.msgprint(
                f"Removed linkage with Payment Requisition {pr.name}",
                alert=True
            )
        
        # Commit the changes
        frappe.db.commit()
    
    # Set flag to ignore link checks
    doc.flags.ignore_linked_doctypes = ['Payment Requisition']