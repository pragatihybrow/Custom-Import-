// Copyright (c) 2026, Pragati Dike and contributors
// For license information, please see license.txt

frappe.ui.form.on("Payment Requisition", {
    refresh(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(
                __("Send Payment Form to Vendor"),
                function () {
                    const supplierId = (frm.doc.supplier_name && frm.doc.supplier_name.length)
                        ? frm.doc.supplier_name[0].supplier
                        : null;

                    frappe.confirm(
                        `Send Vendor Payment Form link to <b>${supplierId || "supplier"}</b>?`,
                        function () {
                            frappe.call({
                                method: "import.import.doctype.payment_requisition.payment_requisition.send_payment_requisition_vendor_mail",
                                args: {
                                    payment_requisition_name: frm.doc.name
                                },
                                freeze: true,
                                freeze_message: __("Sending email to vendor..."),
                                callback: function (r) {
                                    if (!r.exc) {
                                        frappe.msgprint({
                                            title: __("Email Sent"),
                                            message: __("Vendor payment form link has been sent successfully"),
                                            indicator: "green"
                                        });
                                    }
                                }
                            });
                        }
                    );
                },
            );
        }
    }
});