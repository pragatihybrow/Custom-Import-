// Copyright (c) 2025, Pragati Dike and contributors
// For license information, please see license.txt
frappe.ui.form.on('BOE', {
    on_submit: function(frm) {
        setTimeout(function() {
            frappe.db.get_value('BOE', frm.doc.name, 'payment_requisition')
                .then(r => {
                    const pr = r.message && r.message.payment_requisition;
                    if (pr) {
                        frappe.set_route('Form', 'Payment Requisition', pr);
                    } else {
                        frappe.msgprint("No linked Payment Requisition found.");
                    }
                });
        }, 1000);
    }
});