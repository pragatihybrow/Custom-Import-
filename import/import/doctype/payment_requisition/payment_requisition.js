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
                    }
                });
            }, __('Create'));
        }

        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: { amount: frm.doc.duty_amount },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }

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
    
    },

    duty_amount: function(frm) {
        if (frm.doc.duty_amount) {
            frappe.call({
                method: "import.import.doctype.payment_requisition.payment_requisition.get_amount_in_words",
                args: { amount: frm.doc.duty_amount },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value("duty_amount_in_word", r.message);
                    }
                }
            });
        } else {
            frm.set_value("duty_amount_in_word", "");
        }
    },

    onload: function(frm) {
        if (!frm.doc.posting_date) {
            frm.set_value("posting_date", frappe.datetime.get_today());
        }
    }
});


// ─── Dialog ───────────────────────────────────────────────────────────────────

function show_pickup_request_dialog(frm) {
    // Collect already-linked pickup requests to exclude from dialog listing
    let already_linked = (frm.doc.pickup_request || [])
        .map(r => r.pickup_request)
        .filter(Boolean);

    let d = new frappe.ui.Dialog({
        title: __('Select Pickup Requests'),
        fields: [
            {
                fieldname: 'search_filter',
                fieldtype: 'Data',
                label: __('Search'),
                placeholder: __('Type to search...'),
                onchange: function() {
                    window.current_page = 1;
                    filter_and_render_table(this.value);
                }
            },
            { fieldname: 'pickup_request_html', fieldtype: 'HTML' },
            { fieldname: 'pagination_html', fieldtype: 'HTML' }
        ],
        size: 'extra-large',
        primary_action_label: __('Fetch Details'),
        primary_action: function() {
            let selected = [];
            d.$wrapper.find('input[name="pickup_request_check"]:checked').each(function() {
                selected.push($(this).val());
            });

            if (selected.length === 0) {
                frappe.msgprint(__('Please select at least one Pickup Request'));
                return;
            }
            fetch_pickup_request_details(frm, selected);
            d.hide();
        }
    });

    frappe.call({
        method: 'import.import.doctype.payment_requisition.payment_requisition.get_available_pickup_requests',
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                // Filter out already-linked ones from the display list
                window.all_pickup_data = r.message.filter(
                    row => !already_linked.includes(row.name)
                );
                window.current_page = 1;
                window.items_per_page = 5;
                window.current_dialog = d;

                if (window.all_pickup_data.length > 0) {
                    render_pickup_requests(d, window.all_pickup_data);
                } else {
                    d.fields_dict.pickup_request_html.$wrapper.html(
                        '<div class="text-center text-muted" style="padding: 50px;">' +
                        '<i class="fa fa-inbox fa-3x"></i><br><br>' +
                        '<h4>No More Pickup Requests Available</h4>' +
                        '<p>All available pickup requests are already linked to this form.</p>' +
                        '</div>'
                    );
                },
            );
        }
    }
});