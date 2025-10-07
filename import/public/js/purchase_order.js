frappe.ui.form.on("Purchase Order", {
    refresh: function (frm) {
        if (frm.doc.docstatus == 1) {
            // Ensure we are appending to existing Create menu
            frm.page.set_inner_btn_group_as_primary(__('Create'));

            if (frm.doc.custom_purchase_sub_type == "Import") {
                frm.add_custom_button("Pickup Request", function () {
                    create_pickup_request(frm);
                }, __("Create"));
            }
        }
        update_progress_tracking(frm);
        // handle_import_customizations(frm);
        add_conditional_buttons(frm);

    },
    make_purchase_invoice: function(frm) {
        frappe.model.open_mapped_doc({
            method: "erpnext.buying.doctype.purchase_order.purchase_order.make_purchase_invoice",
            frm: frm,
            args: {
                custom_purchase_order: frm.doc.name,
                custom_pickup_request: frm.doc.custom_pickup_request
            }
        });
    },

    // supplier: function(frm) {
    //     load_supplier_defaults(frm);
    // },

    onload: function(frm) {
        if (frm.doc.items) {
            frm.doc.items.forEach(item => {
                check_item_group(frm, item);
                fetch_mr_item_fields(frm, item);
            });
        }
    },
});


function create_pickup_request(frm) {
    try {
        const pickup_data = prepare_pickup_request_data(frm);

        if (!pickup_data.purchase_order_details.length) {
            frappe.msgprint(__('All items are already fully picked.'));
            return;
        }

        frappe.call({
            method: "frappe.client.insert",
            args: { doc: pickup_data },
            callback: function (r) {
                if (!r.exc && r.message?.name) {
                    const pickup_request_name = r.message.name;

                    // Attach PO PDF to the Pickup Request
                    frappe.call({
                        method: "import.import.doctype.pickup_request.pickup_request.attach_po_pdf_to_pickup_request",
                        args: {
                            po_name: frm.doc.name,
                            pickup_request_name: pickup_request_name,
                            format_name: "Standard"
                        },
                        callback: function () {
                            frappe.set_route("Form", "Pickup Request", pickup_request_name);
                        }
                    });
                } else {
                    frappe.msgprint(__('Error creating Pickup Request.'));
                }
            }
        });
    } catch (error) {
        console.error("Error in create_pickup_request:", error);
        frappe.msgprint(__('Error preparing Pickup Request data.'));
    }
}


function prepare_pickup_request_data(frm) {
    let po_item_details = [];
    
    frm.doc.items.forEach(item => {
        let remaining_qty = item.qty - (item.custom_pick_qty || 0);
        if (remaining_qty > 0) {
            po_item_details.push({
                item: item.item_code,
                material: item.item_name,
                quantity: item.qty,
                material_desc: item.description,
                pick_qty: remaining_qty,
                po_number: item.parent,
                currency: frm.doc.currency,
                currency_rate: frm.doc.conversion_rate,
                rate: item.rate,
                amount: item.amount,
                amount_in_inr: item.base_amount,
            });
        }
    });

    return {
        doctype: "Pickup Request",
        name_of_supplier: [{ supplier: frm.doc.supplier }],
        supplier_address: frm.doc.supplier_address,
        purchase_order_list: [{ po_number: frm.doc.name, currency: frm.doc.currency }],
        purchase_order_details: po_item_details,
        currency: frm.doc.currency,
        conversion_rate: frm.doc.conversion_rate,
        remarks: "Auto-generated from Purchase Order",
        total_amount: parseFloat(frm.doc.total || 0),
        company: frm.doc.company,
        incoterm: frm.doc.incoterm,
        country_origin: frm.doc.custom_country_origin,
        port_of_destination_pod: frm.doc.custom_port_of_destination_pod,
        port_of_loading_pol: frm.doc.custom_port_of_loading_pol,
        po_no: [{ purchase_order: frm.doc.name }],
        po_date: frm.doc.transaction_date,
        company_addrees: frm.doc.billing_address,
        tax_category: frm.doc.tax_category,
        taxes_and_charges: frm.doc.taxes_and_charges
    };
}

function check_item_group(frm, item) {
    if (!item.item_code) return;

    frappe.call({
        method: "frappe.client.get_value",
        args: { doctype: "Item", filters: { name: item.item_code }, fieldname: "item_group" },
        callback: function(response) {
            if (!response.exc && response.message) {
                let editable = response.message.item_group !== "Raw Material";
                const grid_row = frm.fields_dict['items'].grid.grid_rows_by_docname[item.name];
                if (grid_row) grid_row.toggle_editable('rate', editable);
            }
        }
    });
}

function fetch_mr_item_fields(frm, item) {
    if (!item.material_request_item || 
        item.custom_materil_po_text || 
        item.custom_supplier_suggestion || 
        item.custom_item_note || 
        item.custom_other_remarks) return;

    frappe.call({
        method: "import.config.py.purchase_order.get_mr_item_fields",
        args: { mr_item_name: item.material_request_item },
        callback: function(response) {
            if (!response.exc && response.message) {
                const data = response.message;
                const updates = [
                    ["custom_materil_po_text", data.custom_materil_po_text],
                    ["custom_supplier_suggestion", data.custom_supplier_suggestion],
                    ["custom_item_note", data.custom_item_note],
                    ["custom_other_remarks", data.custom_other_remarks]
                ];

                updates.forEach(([field, value]) => {
                    if (value) frappe.model.set_value(item.doctype, item.name, field, value);
                });
            }
        }
    });
}

function should_show_pickup_request_button(frm) {
    return frm.doc.custom_purchase_sub_type === "Import" && 
           frm.doc.docstatus == 1 && 
           frm.doc.custom_pickup_status !== "Fully Picked";
}

function should_show_update_rate_button(frm) {
    return frm.doc.docstatus === 0 && 
           frm.doc.status === "Draft" && 
           !frm.is_new();
}


function update_progress_tracking(frm) {
    frappe.call({
        method: "import.config.py.purchase_order.get_stage_status",
        args: { purchase_order_name: frm.doc.name },
        callback: function (r) {
            if (!r.exc && r.message) {
                update_progress_bar(frm, r.message);
            }
        }
    });
}
function update_progress_bar(frm, stage_status) {
    let stages_html = '';

    // ---- Loop through each Pickup Request ----
    for (let pr in stage_status.pickup_requests) {
        const pr_stages = stage_status.pickup_requests[pr];
        stages_html += `<div style="margin-bottom:5px; font-weight:bold;">${pr}</div>`;
        stages_html += `<div class="stage-details" style="font-size:12px; color:#666; margin-left:10px;">
            ${Object.keys(pr_stages).map(stage => `<span style="margin-right:15px;">${stage.replace(/_/g,' ')}: ${pr_stages[stage]}</span>`).join('')}
        </div>`;
    }

    // ---- PO-level stages ----
    const po_stages = ['payment_entry', 'purchase_receipt', 'purchase_invoice'];
    stages_html += `<div style="margin-top:10px; font-weight:bold;">PO-level stages</div>`;
    stages_html += `<div class="stage-details" style="font-size:12px; color:#666; margin-left:10px;">
        ${po_stages.map(stage => `<span style="margin-right:15px;">${stage.replace(/_/g,' ')}: ${stage_status[stage]}</span>`).join('')}
    </div>`;

    // ---- Optional progress bar (based on completed stages / total stages) ----
    const totalStages = Object.keys(stage_status.pickup_requests).length * 4 + po_stages.length; // 4 stages per pickup request + PO-level
    const completedStages = Object.values(stage_status.pickup_requests).reduce((sum, pr) => {
        return sum + Object.values(pr).filter(v => v > 0).length;
    }, 0) + po_stages.filter(stage => stage_status[stage] > 0).length;

    const progress = Math.round((completedStages / totalStages) * 100);

    const progress_html = `
        <div class="progress-container" style="width:100%; background-color:#f0f0f0; border-radius:5px; overflow:hidden; margin:10px 0;">
            <div class="progress-bar" style="width:${progress}%; background-color:#4caf50; height:25px; text-align:center; color:white; line-height:25px; transition:width 0.3s ease;">
                ${progress}% Complete
            </div>
        </div>
        ${stages_html}
    `;

    if (frm.fields_dict.custom_progress_bar?.$wrapper) {
        frm.fields_dict.custom_progress_bar.$wrapper.html(progress_html);
    }
}

function setup_field_queries(frm) {
    frm.set_query("account_head", "custom_purchase_extra_charge", function () {
        return { 
            filters: { 
                company: frm.doc.company,
                account_type: ["in", ["Expense Account", "Cost of Goods Sold"]]
            } 
        };
    });
}



// function handle_import_customizations(frm) {
//     if (!frm.doc.custom_pickup_request?.length) {
//         hide_payment_button(frm);
//         return;
//     }

//     let pickup_request_names = frm.doc.custom_pickup_request.map(row => row.pickup_request);

//     frappe.call({
//         method: "frappe.client.get_list",
//         args: {
//             doctype: "Pre Alert",
//             filters: { pickup_request: ['in', pickup_request_names] },
//             fields: ["name"],
//             limit_page_length: 1
//         },
//         callback: function(r) {
//             if (!r.exc && r.message?.length) {
//                 add_custom_payment_button(frm);
//             } else {
//                 hide_payment_button(frm);
//             }
//         }
//     });
// }


// function hide_payment_button(frm) {
//     setTimeout(() => {
//         frm.remove_custom_button('Payment');
//         frm.remove_custom_button('Payment', 'Create');
//     }, 100);
// }

// function add_custom_payment_button(frm) {
//     setTimeout(() => {
//         frm.remove_custom_button('Payment');
//         frm.remove_custom_button('Payment', 'Create');

//         frm.add_custom_button(__('Payment'), function() {
//             select_pickup_request_dialog(frm);
//         }, __('Create'));
//     }, 100);
// }

// function select_pickup_request_dialog(frm) {
//     let pickup_requests = frm.doc.custom_pickup_request.map(row => row.pickup_request);

//     if (!pickup_requests.length) {
//         frappe.msgprint(__('No Pickup Requests linked to this Purchase Order.'));
//         return;
//     }

//     let dialog = new frappe.ui.Dialog({
//         title: __('Select Pickup Request for Payment'),
//         fields: [
//             {
//                 fieldname: 'pickup_request',
//                 fieldtype: 'Link',
//                 options: 'Pickup Request',
//                 label: __('Pickup Request'),
//                 reqd: 1,
//                 get_query: () => {
//                     return { filters: { name: ['in', pickup_requests], docstatus: 1 } };
//                 }
//             }
//         ],
//         primary_action_label: __('Create Payment'),
//         primary_action: function() {
//             let selected = dialog.get_value('pickup_request'); // single value
//             dialog.hide();
//             if (selected) {
//                 create_payment_with_pickup_amount(frm, selected);
//             }
//         }
//     });

//     dialog.show();
// }

// function create_payment_with_pickup_amount(frm, selected_pickup_request) {
//     frappe.call({
//         method: "import.config.py.purchase_order.prepare_payment_entry",
//         args: {
//             dt: frm.doc.doctype,
//             dn: frm.doc.name,
//             pickup_request: selected_pickup_request
//         },
//         callback: function(r) {
//             if (r.message) {
//                 let payment_entry = frappe.model.sync(r.message)[0];
//                 payment_entry.custom_pickup_request = selected_pickup_request;
//                 frappe.set_route('Form', 'Payment Entry', payment_entry.name);
//             }
//         }
//     });
// }


function add_conditional_buttons(frm) {
    if (should_show_pickup_request_button(frm)) {
        frm.add_custom_button("Pickup Request", function () {
            create_pickup_request(frm);
        }, __("Create"));
    }
}




